/**
 * Öffentliche Shop-Routen (Stripe Checkout, Webhook, Session-Claim).
 * PCI: keine Kartendaten — nur Stripe Hosted Checkout + Webhook-Signatur.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import { CFG } from '../../config.js';
import { logger } from '../../logger.js';
import { normalizeAddress } from '../../utils.js';
import { hashClaimToken } from '../../voucher-claim-state.js';
import { getPublicShopProducts, getShopProductById, resolveStripePriceId } from './catalog.js';
import { getShopSessionClaim, putShopSessionClaimIfAbsent } from './shop-session-claims.js';
import { isStripeEventProcessed, markStripeEventProcessed } from './stripe-processed-events.js';
import { notifyShopClaimDelivered, runShopFulfillmentChainStep } from '../iota/shop-fulfillment.js';

type SendJsonFn = (
    res: http.ServerResponse,
    status: number,
    data: object,
    cors?: Record<string, string>
) => void;

const shopCheckoutRateLimitByIp = new Map<string, { count: number; resetAt: number }>();

function shopPublicBase(): string {
    return CFG.SHOP_PUBLIC_BASE_URL || `http://127.0.0.1:${CFG.UI_PORT}`;
}

function checkShopCheckoutRateLimit(ip: string): boolean {
    const limit = CFG.SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE;
    if (limit <= 0) return true;
    const now = Date.now();
    const entry = shopCheckoutRateLimitByIp.get(ip);
    if (!entry) return true;
    if (now >= entry.resetAt) return true;
    return entry.count < limit;
}

function recordShopCheckoutRateLimit(ip: string): void {
    const limit = CFG.SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE;
    if (limit <= 0) return;
    const now = Date.now();
    const windowMs = 60_000;
    let entry = shopCheckoutRateLimitByIp.get(ip);
    if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        shopCheckoutRateLimitByIp.set(ip, entry);
    }
    entry.count++;
}

function getStripe(): Stripe | null {
    if (!CFG.STRIPE_SECRET_KEY) return null;
    return new Stripe(CFG.STRIPE_SECRET_KEY, { typescript: true });
}

function readJsonBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
    return new Promise((resolve, reject) => {
        let buf = Buffer.alloc(0);
        req.on('data', (chunk: Buffer | string) => {
            const c = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            buf = Buffer.concat([buf, c]);
            if (buf.length > maxBytes) {
                reject(new Error('Body zu groß'));
            }
        });
        req.on('end', () => resolve(buf.toString('utf8')));
        req.on('error', reject);
    });
}

function readRawBody(req: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let len = 0;
        req.on('data', (chunk: Buffer | string) => {
            const c = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            len += c.length;
            if (len > maxBytes) {
                reject(new Error('Body zu groß'));
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

async function handleCheckoutSession(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    ip: string
): Promise<void> {
    if (!checkShopCheckoutRateLimit(ip)) {
        sendJson(res, 429, { ok: false, error: 'Rate-Limit (SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE).' }, cors);
        return;
    }
    const stripe = getStripe();
    if (!stripe) {
        sendJson(res, 503, { ok: false, error: 'Stripe nicht konfiguriert (STRIPE_SECRET_KEY).' }, cors);
        return;
    }
    let body: string;
    try {
        body = await readJsonBody(req, 32_768);
    } catch {
        sendJson(res, 413, { ok: false, error: 'Body zu groß' }, cors);
        return;
    }
    let data: { productId?: string; customerEmail?: string; recipientIotaAddress?: string };
    try {
        data = JSON.parse(body || '{}') as { productId?: string; customerEmail?: string; recipientIotaAddress?: string };
    } catch {
        sendJson(res, 400, { ok: false, error: 'Ungültiges JSON' }, cors);
        return;
    }
    const productId = String(data.productId ?? '').trim();
    const customerEmail = String(data.customerEmail ?? '').trim();
    const recipientIotaAddress = String(data.recipientIotaAddress ?? '').trim();
    if (recipientIotaAddress && !/^0x[a-fA-F0-9]{64}$/i.test(recipientIotaAddress)) {
        sendJson(res, 400, { ok: false, error: 'recipientIotaAddress muss 0x + 64 Hex sein (oder leer lassen).' }, cors);
        return;
    }
    const product = getShopProductById(productId);
    if (!product) {
        sendJson(res, 400, { ok: false, error: 'Unbekanntes productId.' }, cors);
        return;
    }
    const priceId = resolveStripePriceId(product);
    if (!priceId) {
        sendJson(res, 503, { ok: false, error: `Stripe Price ID fehlt (Env ${product.stripePriceIdEnv}).` }, cors);
        return;
    }
    const base = shopPublicBase();
    try {
        const metadata: Record<string, string> = {
            productId: product.id,
            morgendrot_shop: '1',
        };
        if (recipientIotaAddress) {
            metadata.recipient_iota_address = normalizeAddress(recipientIotaAddress);
        }
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${base}/shop?paid=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${base}/shop?canceled=1`,
            customer_email: customerEmail || undefined,
            metadata,
        });
        recordShopCheckoutRateLimit(ip);
        sendJson(
            res,
            200,
            {
                ok: true,
                url: session.url,
                sessionId: session.id,
                note: 'Weiterleitung zu Stripe Hosted Checkout — keine Kartendaten auf diesem Server.',
            },
            cors
        );
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn('[shop] checkout.sessions.create: ' + msg);
        sendJson(res, 502, { ok: false, error: msg }, cors);
    }
}

async function handleSessionClaim(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    ip: string
): Promise<void> {
    if (!checkShopCheckoutRateLimit(ip)) {
        sendJson(res, 429, { ok: false, error: 'Rate-Limit (SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE).' }, cors);
        return;
    }
    const stripe = getStripe();
    if (!stripe) {
        sendJson(res, 503, { ok: false, error: 'Stripe nicht konfiguriert (STRIPE_SECRET_KEY).' }, cors);
        return;
    }
    let body: string;
    try {
        body = await readJsonBody(req, 16_384);
    } catch {
        sendJson(res, 413, { ok: false, error: 'Body zu groß' }, cors);
        return;
    }
    let data: { sessionId?: string };
    try {
        data = JSON.parse(body || '{}') as { sessionId?: string };
    } catch {
        sendJson(res, 400, { ok: false, error: 'Ungültiges JSON' }, cors);
        return;
    }
    const sessionId = String(data.sessionId ?? '').trim();
    if (!sessionId.startsWith('cs_')) {
        sendJson(res, 400, { ok: false, error: 'sessionId (cs_…) fehlt oder ungültig.' }, cors);
        return;
    }
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            sendJson(res, 400, { ok: false, error: 'Zahlung für diese Session nicht abgeschlossen.' }, cors);
            return;
        }
        const row = await getShopSessionClaim(sessionId);
        recordShopCheckoutRateLimit(ip);
        if (!row) {
            sendJson(
                res,
                202,
                {
                    ok: true,
                    pending: true,
                    note: 'Webhook noch nicht verarbeitet — bitte wenige Sekunden warten und erneut versuchen.',
                },
                cors
            );
            return;
        }
        sendJson(
            res,
            200,
            {
                ok: true,
                claimToken: row.claimToken,
                productId: row.productId,
                issuedAt: row.issuedAt,
                note: 'Claim-Token für POST /api/voucher-claim (wenn ENABLE_VOUCHER_CLAIM_API=true).',
            },
            cors
        );
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn('[shop] session retrieve: ' + msg);
        sendJson(res, 400, { ok: false, error: msg }, cors);
    }
}

async function handleStripeWebhook(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    sendJson: SendJsonFn
): Promise<void> {
    if (!CFG.STRIPE_WEBHOOK_SECRET) {
        sendJson(res, 503, { ok: false, error: 'STRIPE_WEBHOOK_SECRET fehlt.' });
        return;
    }
    const stripe = getStripe();
    if (!stripe) {
        sendJson(res, 503, { ok: false, error: 'STRIPE_SECRET_KEY fehlt.' });
        return;
    }
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
        sendJson(res, 400, { ok: false, error: 'Stripe-Signatur fehlt.' });
        return;
    }
    let raw: Buffer;
    try {
        raw = await readRawBody(req, 2 * 1024 * 1024);
    } catch {
        sendJson(res, 413, { ok: false, error: 'Body zu groß' });
        return;
    }
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(raw, sig, CFG.STRIPE_WEBHOOK_SECRET);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn('[shop] webhook signature: ' + msg);
        sendJson(res, 400, { ok: false, error: 'Ungültige Webhook-Signatur.' });
        return;
    }

    if (event.type !== 'checkout.session.completed') {
        sendJson(res, 200, { ok: true, received: true, ignored: true, type: event.type });
        return;
    }

    if (await isStripeEventProcessed(event.id)) {
        sendJson(res, 200, { ok: true, received: true, duplicate: true });
        return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    if (!sessionId || !sessionId.startsWith('cs_')) {
        await markStripeEventProcessed(event.id);
        sendJson(res, 200, { ok: true, received: true, note: 'Keine gültige Session-ID.' });
        return;
    }
    if (session.payment_status !== 'paid') {
        await markStripeEventProcessed(event.id);
        sendJson(res, 200, { ok: true, received: true, note: 'Session nicht paid.' });
        return;
    }

    const productId = String(session.metadata?.productId || '').trim() || 'unknown';
    const claimToken = crypto.randomBytes(32).toString('hex');
    const issuedAt = new Date().toISOString();
    const recipientMeta = String(session.metadata?.recipient_iota_address || '').trim();
    const customerEmail = String(session.customer_email || '').trim();

    try {
        const { row } = await putShopSessionClaimIfAbsent(sessionId, {
            claimToken,
            issuedAt,
            productId,
            stripeEventId: event.id,
        });
        const prefix = hashClaimToken(row.claimToken).slice(0, 16);
        await runShopFulfillmentChainStep({
            productId,
            stripeSessionId: sessionId,
            claimKeyPrefix: prefix,
            recipientIotaAddress: recipientMeta || undefined,
            customerEmail: customerEmail || undefined,
            sessionClaimRow: row,
        });
        await markStripeEventProcessed(event.id);
        void notifyShopClaimDelivered({
            sessionId,
            productId,
            claimToken: row.claimToken,
            customerEmail: customerEmail || undefined,
        });
        sendJson(res, 200, { ok: true, received: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('[shop] webhook handler: ' + msg);
        sendJson(res, 500, { ok: false, error: 'Interner Fehler' });
    }
}

/**
 * @returns true wenn die Anfrage bearbeitet wurde (inkl. Fehlerantwort).
 */
export async function handleShopApi(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): Promise<boolean> {
    if (!CFG.ENABLE_SHOP_API) return false;

    const method = (req.method || 'GET').toUpperCase();

    if (url === '/api/shop/products' && method === 'GET') {
        sendJson(res, 200, { ok: true, products: getPublicShopProducts() }, cors);
        return true;
    }

    const ip = (req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');

    if (url === '/api/shop/checkout-session' && method === 'POST') {
        await handleCheckoutSession(req, res, cors, sendJson, ip);
        return true;
    }

    if (url === '/api/shop/session-claim' && method === 'POST') {
        await handleSessionClaim(req, res, cors, sendJson, ip);
        return true;
    }

    if (url === '/api/shop/webhook/stripe' && method === 'POST') {
        await handleStripeWebhook(req, res, sendJson);
        return true;
    }

    return false;
}
