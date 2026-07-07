/**
 * Boss-Wallet-Hilfen — Testnet-Faucet leitet auf die Web-UI (Turnstile-Captcha).
 */
import type http from 'node:http';
import { CFG } from '../../config.js';
import type { SendJsonFn } from './api-route-types.js';
import { buildIotaTestnetFaucetUrl, isHttpUrl, normalizeIotaTestnetFaucetBase } from '../../shared/iota-testnet-faucet-url.js';
import {
    fetchWalletNativeBalancesForAddress,
    resolveBossWalletAddressForBalance,
} from '../wallet-native-balances.js';

const ADDR_RE = /^0x[a-fA-F0-9]{64}$/i;

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    let body = '';
    await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => resolve());
        req.on('error', reject);
    });
    try {
        const parsed = JSON.parse(body || '{}') as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

export async function handleBossWalletRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): Promise<boolean> {
    if (url === '/api/wallet-balances' && req.method === 'GET') {
        if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'kommandant') {
            sendJson(res, 403, { ok: false, error: 'Nur Boss oder Kommandant.' }, cors);
            return true;
        }
        const myAddr = resolveBossWalletAddressForBalance();
        if (!myAddr || !ADDR_RE.test(myAddr)) {
            sendJson(
                res,
                200,
                { ok: true, address: null, message: 'Keine Wallet-Adresse konfiguriert.' },
                cors
            );
            return true;
        }
        const balances = await fetchWalletNativeBalancesForAddress(myAddr);
        sendJson(res, 200, { ok: true, address: myAddr, ...balances }, cors);
        return true;
    }

    if (url !== '/api/request-testnet-gas' && url !== '/api/request-testnet-faucet-url') return false;
    if (req.method !== 'POST' && req.method !== 'GET') return false;

    if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'kommandant') {
        sendJson(res, 403, { ok: false, error: 'Nur Boss oder Kommandant.' }, cors);
        return true;
    }

    const data = req.method === 'POST' ? await readJsonBody(req) : {};
    const fromBody = typeof data.recipient === 'string' ? data.recipient.trim() : '';
    const fromServer = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
    const recipient = ADDR_RE.test(fromBody) ? fromBody : ADDR_RE.test(fromServer) ? fromServer : undefined;
    const customOpen =
        typeof data.customOpenUrl === 'string' && isHttpUrl(data.customOpenUrl) ? data.customOpenUrl.trim() : '';
    const faucetBase =
        typeof data.faucetBase === 'string' && data.faucetBase.trim()
            ? normalizeIotaTestnetFaucetBase(data.faucetBase)
            : undefined;
    const openUrl = customOpen
        ? customOpen.includes('://')
            ? customOpen
            : `https://${customOpen}`
        : buildIotaTestnetFaucetUrl(recipient, faucetBase ? { baseUrl: faucetBase } : undefined);

    sendJson(
        res,
        200,
        {
            ok: true,
            openUrl,
            message: recipient
                ? 'Testnet-Faucet im Browser öffnen — Captcha bestätigen (automatisch ohne Browser nicht möglich).'
                : 'Testnet-Faucet im Browser öffnen — Wallet-Adresse eintragen und Captcha bestätigen.',
        },
        cors
    );
    return true;
}
