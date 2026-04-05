/**
 * On-Chain-Schritt nach erfolgreicher Shop-Zahlung (optional) + optional Notify-Webhook (E-Mail-Backend).
 * Kein Import von wallet-bridge (Zyklen) — Passwort nur aus messenger-session-password / Env.
 */
import { fetch } from 'undici';
import { CFG } from '../../config.js';
import { logger } from '../../logger.js';
import { mintMessengerCreditsBatchForRecipients, type MessengerCreditsMintParams } from '../../chain-access.js';
import { normalizeAddress } from '../../utils.js';
import { getWalletPassword } from '../../messenger-nest/messenger-session-password.js';
import {
    type ShopSessionClaimRow,
    updateShopSessionClaimMintTx,
} from '../shop/shop-session-claims.js';

export type ShopFulfillmentInput = {
    productId: string;
    stripeSessionId: string;
    /** Erste 16 Hex-Zeichen von SHA-256(claimToken) */
    claimKeyPrefix: string;
    /** Aus Stripe Checkout Metadata, falls Kunde IOTA-Adresse angegeben hat */
    recipientIotaAddress?: string;
    customerEmail?: string;
    sessionClaimRow: ShopSessionClaimRow;
};

function messengerCreditsParamsForProduct(productId: string): MessengerCreditsMintParams {
    switch (productId) {
        case 'messenger-messages-500':
            return {
                initialBalance: 500n,
                maxBalance: 5000n,
                refillIntervalMs: 86_400_000n,
                refillAmount: 50n,
                costEcdhInit: 1n,
                costStoreMessage: 1n,
            };
        default:
            return {
                initialBalance: 100n,
                maxBalance: 1000n,
                refillIntervalMs: 86_400_000n,
                refillAmount: 10n,
                costEcdhInit: 1n,
                costStoreMessage: 1n,
            };
    }
}

function bossSignerAddress(): string {
    const raw = (CFG.BOSS_ADDRESS || CFG.MY_ADDRESS || '').trim();
    if (!raw || !/^0x[a-fA-F0-9]{64}$/i.test(raw)) {
        throw new Error('BOSS_ADDRESS oder MY_ADDRESS (0x+64 Hex) für Shop-Mint fehlt.');
    }
    return normalizeAddress(raw);
}

/**
 * Optional: HTTPS POST an eigenes Backend (Mail-Versand, CRM). Nie ohne TLS in Produktion.
 */
export async function notifyShopClaimDelivered(payload: {
    sessionId: string;
    productId: string;
    claimToken: string;
    customerEmail?: string;
}): Promise<void> {
    const url = CFG.SHOP_CLAIM_NOTIFY_WEBHOOK_URL;
    if (!url) return;
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (CFG.SHOP_CLAIM_NOTIFY_SECRET) {
            headers['X-Morgendrot-Shop-Notify-Secret'] = CFG.SHOP_CLAIM_NOTIFY_SECRET;
        }
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sessionId: payload.sessionId,
                productId: payload.productId,
                claimToken: payload.claimToken,
                customerEmail: payload.customerEmail || '',
            }),
        });
        if (!res.ok) {
            logger.warn(`[shop-notify] HTTP ${res.status} von Notify-URL`);
        }
    } catch (e: unknown) {
        logger.warn('[shop-notify] ' + (e instanceof Error ? e.message : String(e)));
    }
}

export async function runShopFulfillmentChainStep(input: ShopFulfillmentInput): Promise<{ ok: boolean; detail: string }> {
    const row = input.sessionClaimRow;
    if (row.mintTxDigest) {
        return { ok: true, detail: `Chain-Mint bereits verbucht (Digest ${row.mintTxDigest.slice(0, 12)}…).` };
    }

    const wantMint = CFG.ENABLE_SHOP_CHAIN_MINT;
    const recipientRaw = (input.recipientIotaAddress || '').trim();
    const recipientOk = /^0x[a-fA-F0-9]{64}$/i.test(recipientRaw);

    if (!wantMint || !recipientRaw) {
        logger.info(
            `[shop-fulfillment] token-only productId=${input.productId} session=${input.stripeSessionId.slice(0, 12)}… prefix=${input.claimKeyPrefix} (ENABLE_SHOP_CHAIN_MINT=${wantMint}, hasRecipient=${Boolean(recipientRaw)})`
        );
        return {
            ok: true,
            detail:
                'Kein On-Chain-Mint: ENABLE_SHOP_CHAIN_MINT aus oder keine recipient_iota_address im Checkout. Nur Claim-Token.',
        };
    }

    if (!recipientOk) {
        logger.warn(`[shop-fulfillment] ungültige Empfängeradresse (Metadata), Mint übersprungen: ${recipientRaw.slice(0, 16)}…`);
        return { ok: true, detail: 'Empfängeradresse ungültig — Mint übersprungen, Claim-Token bleibt gültig.' };
    }

    const recipient = normalizeAddress(recipientRaw);
    const boss = bossSignerAddress();
    const pw =
        getWalletPassword()?.trim() ||
        (process.env.SHOP_MINT_BOSS_WALLET_PASSWORD || process.env.BOSS_WALLET_PASSWORD || '').trim();
    if (!pw) {
        throw new Error(
            'Shop-Chain-Mint: Boss-Wallet nicht entsperrt (Session-Passwort) und SHOP_MINT_BOSS_WALLET_PASSWORD/BOSS_WALLET_PASSWORD fehlt.'
        );
    }

    const params = messengerCreditsParamsForProduct(input.productId);
    const map = await mintMessengerCreditsBatchForRecipients(boss, [recipient], params, pw);
    const creditsId = map.get(recipient);
    if (!creditsId) {
        throw new Error('Messenger-Credits-Mint: keine Objekt-ID in Antwort.');
    }

    /** Idempotenz-Marker (kein TX-Digest aus mintMessengerCreditsBatchForRecipients; Credits-ID reicht als Nachweis). */
    await updateShopSessionClaimMintTx(input.stripeSessionId, `credits:${creditsId}`);

    logger.info(
        `[shop-fulfillment] mint OK recipient=${recipient.slice(0, 10)}… creditsId=${creditsId.slice(0, 10)}… productId=${input.productId}`
    );

    return {
        ok: true,
        detail: `Messenger-Credits gemint (Objekt ${creditsId.slice(0, 12)}…).`,
    };
}
