/**
 * Boss-Roster Pending API — serverseitige Queue (Handoff + Beitrittsanfragen).
 */
import type http from 'node:http';
import { CFG } from '../../config.js';
import {
    listRosterPendingEntries,
    removeRosterPendingEntry,
    setRosterPendingStatus,
    upsertRosterPendingEntry,
} from '../../roster-pending.js';
import { parseRosterPendingUpsert, type RosterPendingStatus } from '../../shared/roster-pending.js';
import type { SendJsonFn } from './api-route-types.js';
import { readHttpBodyWithLimit } from './api-body-limit.js';

function canManageRosterPending(): boolean {
    const role = (CFG.ROLE || '').trim();
    return role === 'boss' || role === 'kommandant';
}

function parseStatus(raw: unknown): RosterPendingStatus | null {
    const s = String(raw ?? '').trim();
    if (s === 'pending' || s === 'approved' || s === 'dismissed' || s === 'rejected') return s;
    return null;
}

export async function handleRosterPendingRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): Promise<boolean> {
    if (url === '/api/roster-pending' && req.method === 'GET') {
        if (!canManageRosterPending()) {
            sendJson(res, 403, { ok: false, error: 'Nur Boss/Kommandant.' }, cors);
            return true;
        }
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const status = parseStatus(u.searchParams.get('status') || 'pending') ?? 'pending';
            const entries = listRosterPendingEntries({ status });
            sendJson(res, 200, { ok: true, entries }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/roster-pending' && req.method === 'POST') {
        if (!canManageRosterPending()) {
            sendJson(res, 403, { ok: false, error: 'Nur Boss/Kommandant.' }, cors);
            return true;
        }
        const body = await readHttpBodyWithLimit(req, 65536);
        if (!body.ok) {
            sendJson(res, 413, { ok: false, error: body.error }, cors);
            return true;
        }
        try {
            const data = JSON.parse(body.text || '{}');
            const v = parseRosterPendingUpsert(data);
            if (!v.ok) {
                sendJson(res, 400, { ok: false, error: v.error }, cors);
                return true;
            }
            const entry = upsertRosterPendingEntry(v.entry);
            sendJson(res, 200, { ok: true, entry }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    const statusMatch = url.match(/^\/api\/roster-pending\/([^/]+)\/status$/);
    if (statusMatch && req.method === 'POST') {
        if (!canManageRosterPending()) {
            sendJson(res, 403, { ok: false, error: 'Nur Boss/Kommandant.' }, cors);
            return true;
        }
        const body = await readHttpBodyWithLimit(req, 4096);
        if (!body.ok) {
            sendJson(res, 413, { ok: false, error: body.error }, cors);
            return true;
        }
        try {
            const data = JSON.parse(body.text || '{}');
            const status = parseStatus(data.status);
            if (!status) {
                sendJson(res, 400, { ok: false, error: 'status ungültig.' }, cors);
                return true;
            }
            const entry = setRosterPendingStatus(decodeURIComponent(statusMatch[1]), status);
            if (!entry) {
                sendJson(res, 404, { ok: false, error: 'Eintrag nicht gefunden.' }, cors);
                return true;
            }
            sendJson(res, 200, { ok: true, entry }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    const deleteMatch = url.match(/^\/api\/roster-pending\/([^/]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
        if (!canManageRosterPending()) {
            sendJson(res, 403, { ok: false, error: 'Nur Boss/Kommandant.' }, cors);
            return true;
        }
        const removed = removeRosterPendingEntry(decodeURIComponent(deleteMatch[1]));
        sendJson(res, 200, { ok: true, removed }, cors);
        return true;
    }

    return false;
}
