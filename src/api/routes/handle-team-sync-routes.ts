/**
 * Team-Sync LAN Push / Inbox — § TEAM-MEMBER-UPDATE-WIZARD-SPEC §8.3 Prio 0.
 */
import type http from 'node:http';
import { CFG } from '../../config.js';
import { listTeamSyncLanInbox, pushTeamSyncLanWire } from '../../team-sync-lan-outbox.js';
import type { SendJsonFn } from './api-route-types.js';
import { readHttpBodyWithLimit } from './api-body-limit.js';
import { buildTeamWireSignBytes } from '../../shared/morg-team-wire-signature.js';
import { signPersonalMessageWithSdkSigner } from '../../chain-access.js';

function canPushTeamSync(): boolean {
    const role = (CFG.ROLE || '').trim();
    return role === 'boss' || role === 'kommandant';
}

export async function handleTeamSyncRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): Promise<boolean> {
    if (url === '/api/team-sync/push' && req.method === 'POST') {
        if (!canPushTeamSync()) {
            sendJson(res, 403, { ok: false, error: 'Nur Boss/Kommandant.' }, cors);
            return true;
        }
        const body = await readHttpBodyWithLimit(req, 65536);
        if (!body.ok) {
            sendJson(res, 413, { ok: false, error: body.error }, cors);
            return true;
        }
        try {
            const data = JSON.parse(body.text || '{}') as Record<string, unknown>;
            const entry = pushTeamSyncLanWire({
                wire: String(data.wire ?? ''),
                teamMailboxAddress: data.teamMailboxAddress != null ? String(data.teamMailboxAddress) : undefined,
                teamId: data.teamId != null ? String(data.teamId) : undefined,
                seq: typeof data.seq === 'number' ? data.seq : undefined,
                recipientAddresses: Array.isArray(data.recipientAddresses)
                    ? data.recipientAddresses.map((a) => String(a))
                    : undefined,
            });
            sendJson(res, 200, { ok: true, entryId: entry.id, createdAt: entry.createdAt }, cors);
        } catch (e: unknown) {
            sendJson(res, 400, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/team-sync/sign-team-wire' && req.method === 'POST') {
        if (!canPushTeamSync()) {
            sendJson(res, 403, { ok: false, error: 'Nur Boss/Kommandant.' }, cors);
            return true;
        }
        const body = await readHttpBodyWithLimit(req, 65536);
        if (!body.ok) {
            sendJson(res, 413, { ok: false, error: body.error }, cors);
            return true;
        }
        try {
            const data = JSON.parse(body.text || '{}') as { payload?: Record<string, unknown> };
            const payload = data.payload;
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                sendJson(res, 400, { ok: false, error: 'payload (Objekt) erforderlich.' }, cors);
                return true;
            }
            const bytes = buildTeamWireSignBytes(payload as Record<string, unknown>);
            const sigBytes = await signPersonalMessageWithSdkSigner(bytes);
            if (!sigBytes || sigBytes.length === 0) {
                sendJson(res, 409, { ok: false, error: 'Kein SDK-Signer verfügbar (SIGNER=sdk + Tresor entsperrt nötig).' }, cors);
                return true;
            }
            const sig = Buffer.from(sigBytes).toString('base64');
            sendJson(res, 200, { ok: true, sig }, cors);
        } catch (e: unknown) {
            sendJson(res, 400, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url.startsWith('/api/team-sync/lan-inbox') && req.method === 'GET') {
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const recipientAddress = String(u.searchParams.get('address') ?? CFG.MY_ADDRESS ?? '').trim();
            const sinceMs = Number(u.searchParams.get('sinceMs') ?? '0');
            if (!/^0x[a-fA-F0-9]{64}$/.test(recipientAddress)) {
                sendJson(res, 400, { ok: false, error: 'address (0x+64 Hex) erforderlich.' }, cors);
                return true;
            }
            const entries = listTeamSyncLanInbox({
                recipientAddress,
                sinceMs: Number.isFinite(sinceMs) ? sinceMs : 0,
            });
            sendJson(res, 200, { ok: true, entries }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    return false;
}
