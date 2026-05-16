/**
 * POST /api/command — Delegation an Messenger-Command-Handler.
 */
import type http from 'node:http';
import { CFG, getHierarchyPermissions } from '../../config.js';
import type { CommandApiOptions } from '../../messenger-nest/command-api-options.js';
import type { ApiRouteContext, SendJsonFn } from './api-route-types.js';

const commandRateLimitByIp = new Map<string, { count: number; resetAt: number }>();

function checkCommandRateLimit(ip: string): boolean {
    const limit = CFG.API_RATE_LIMIT_COMMANDS_PER_MINUTE;
    if (limit <= 0) return true;
    const now = Date.now();
    const entry = commandRateLimitByIp.get(ip);
    if (!entry) return true;
    if (now >= entry.resetAt) return true;
    return entry.count < limit;
}

function recordCommandRateLimit(ip: string): void {
    const limit = CFG.API_RATE_LIMIT_COMMANDS_PER_MINUTE;
    if (limit <= 0) return;
    const now = Date.now();
    const windowMs = 60_000;
    let entry = commandRateLimitByIp.get(ip);
    if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        commandRateLimitByIp.set(ip, entry);
    }
    entry.count++;
}

function getRequiredPermissionForCommand(cmd: string): 'keyIssue' | 'revokeDown' | 'commandDown' | null {
    const c = (cmd || '').trim().toLowerCase();
    if (['/create-key', '/create-keys', '/create-key-and-notify', '/create-ticket', '/create-tickets'].includes(c)) {
        return 'keyIssue';
    }
    if (
        [
            '/purge-key',
            '/emergency-purge-key',
            '/purge-handshake',
            '/purge-msg',
            '/emergency-purge',
            '/purge-ticket',
            '/emergency-purge-ticket',
        ].includes(c)
    ) {
        return 'revokeDown';
    }
    if (['/transfer-coins'].includes(c)) return 'commandDown';
    return null;
}

export function handleCommandRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    ctx: ApiRouteContext
): boolean {
    if (url !== '/api/command' || req.method !== 'POST') return false;

    const ip = (req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
    if (CFG.API_RATE_LIMIT_COMMANDS_PER_MINUTE > 0 && !checkCommandRateLimit(ip)) {
        sendJson(res, 429, { ok: false, error: 'Rate-Limit überschritten (API_RATE_LIMIT_COMMANDS_PER_MINUTE).' }, cors);
        return true;
    }
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });
    req.on('end', async () => {
        try {
            const data = JSON.parse(body || '{}');
            let cmd = String(data.cmd ?? data.command ?? '').trim();
            let args = Array.isArray(data.args) ? data.args.map(String) : [];
            const userMessage = typeof data.userMessage === 'string' ? data.userMessage.trim() : '';
            if (cmd === '/transfer-coins' && args.length < 2 && userMessage) {
                const addr = userMessage.match(/0x[a-fA-F0-9]{64}/);
                const num = userMessage.match(/(\d+(?:\.\d+)?)\s*(?:iota|miota|i)?/i) || userMessage.match(/(\d+(?:\.\d+)?)/);
                if (addr && num) args = [addr[0], num[1]];
            }
            if (!cmd) {
                sendJson(res, 400, { ok: false, error: 'cmd fehlt' }, cors);
                return;
            }
            const role = CFG.ROLE;
            if (role === 'boss' || role === 'kommandant' || role === 'arbeiter') {
                const perms = getHierarchyPermissions(role);
                const need = getRequiredPermissionForCommand(cmd);
                if (need === 'keyIssue' && !perms.keyIssue) {
                    sendJson(res, 403, { ok: false, error: 'Schlüssel ausstellen darf nur der Boss.' }, cors);
                    return;
                }
                if (need === 'revokeDown' && !perms.revokeDown) {
                    sendJson(res, 403, { ok: false, error: 'Widerruf/Sperren: nur Boss oder Kommandant.' }, cors);
                    return;
                }
                if (need === 'commandDown' && !perms.commandDown) {
                    sendJson(res, 403, { ok: false, error: 'Befehl senden (Handshake/Send): nur Boss oder Kommandant.' }, cors);
                    return;
                }
            }
            const commandHandler = ctx.getCommandHandler();
            if (!commandHandler) {
                sendJson(res, 200, { ok: false, error: 'Bitte zuerst Wallet entsperren (Passwort eingeben).' }, cors);
                return;
            }
            if (CFG.API_RATE_LIMIT_COMMANDS_PER_MINUTE > 0) recordCommandRateLimit(ip);
            const commandApiOptions: CommandApiOptions = {};
            if (data.sponsorForSender) commandApiOptions.sponsorForSender = String(data.sponsorForSender).trim();
            if (data.silentFetch === true) commandApiOptions.silentFetch = true;
            if (typeof data.shadowMnemonic === 'string' && data.shadowMnemonic.trim()) {
                commandApiOptions.shadowMnemonic = data.shadowMnemonic.trim();
            }
            if (data.morgPkg != null && typeof data.morgPkg === 'object') {
                commandApiOptions.morgPkg = data.morgPkg;
            }
            const mp = String(data.messagingPersistenceMode ?? '').trim().toLowerCase();
            if (mp === 'mailbox' || mp === 'event') {
                commandApiOptions.messagingPersistenceMode = mp as 'event' | 'mailbox';
            }
            const mbOverride = String(data.mailboxObjectId ?? '').trim();
            if (mbOverride) commandApiOptions.mailboxObjectId = mbOverride;
            const result = await commandHandler(cmd, args, commandApiOptions);
            if (cmd === '/vault-onchain' && result?.ok) ctx.setLastVaultOnchainAt(Date.now());
            if (cmd === '/vault-save' && result?.ok) ctx.setLastVaultOnchainAt(undefined);
            const out = result && typeof result === 'object' ? { ...result } : result;
            const outRec = out && typeof out === 'object' ? (out as Record<string, unknown>) : null;
            if (outRec && Array.isArray(outRec.createdObjectIds)) {
                const ids = outRec.createdObjectIds as string[];
                const explorerBase = (process.env.EXPLORER_BASE_URL || 'https://explorer.iota.org/object').replace(/\/$/, '');
                const network = (CFG.RPC_URL || '').toLowerCase().includes('testnet') ? '?network=testnet' : '';
                outRec.explorerLinks = ids.map((id) => `${explorerBase}/${id}${network}`);
            }
            if (outRec && typeof outRec.objectId === 'string' && outRec.objectId) {
                const oid = outRec.objectId;
                const explorerBase = (process.env.EXPLORER_BASE_URL || 'https://explorer.iota.org/object').replace(/\/$/, '');
                const network = (CFG.RPC_URL || '').toLowerCase().includes('testnet') ? '?network=testnet' : '';
                outRec.explorerLink = `${explorerBase}/${oid}${network}`;
            }
            sendJson(res, 200, outRec ?? out, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
    });
    return true;
}
