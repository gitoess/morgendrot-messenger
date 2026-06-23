/**
 * Telegram-Integration API (§ H.26 Phase A).
 */
import type http from 'node:http';
import {
    getTelegramIntegrationPublic,
    getTelegramIntegrationPublicAsync,
    saveTelegramIntegration,
    sendTelegramContactNotify,
    sendTelegramEinsatzGroupHint,
    sendTelegramTestAlarm,
    sendTelegramTestNotify,
    type SaveTelegramIntegrationInput,
    type TelegramEinsatzGroupEventType,
} from '../../integrations/telegram-integration.js';
import { resolveContactStorageKey } from '../../contact-labels.js';
import { ingestTelegramInboundUpdate, normalizeTelegramInboundMode } from '../../integrations/telegram-inbound.js';
import { restartTelegramInbound } from '../../integrations/telegram-inbound-poll.js';
import { listTelegramJournalEntries } from '../../integrations/telegram-journal.js';
import type { SendJsonFn } from './api-route-types.js';
import { denyTransportRead, denyTransportWrite } from '../../messenger-capability-gates.js';

const NOTIFY_PATH = '/api/integrations/telegram/notify';

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

export async function handleTelegramIntegrationRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): Promise<boolean> {
    if (url === '/api/integrations/telegram' && req.method === 'GET') {
        const pub = await getTelegramIntegrationPublicAsync();
        sendJson(res, 200, pub, cors);
        return true;
    }

    if (url === '/api/integrations/telegram' && req.method === 'POST') {
        const data = await readJsonBody(req);
        const input: SaveTelegramIntegrationInput = {};
        if (data.enabled != null) input.enabled = data.enabled === true;
        if (typeof data.botToken === 'string') input.botToken = data.botToken;
        if (typeof data.adminChatId === 'string') input.adminChatId = data.adminChatId;
        if (typeof data.relayBaseUrl === 'string') input.relayBaseUrl = data.relayBaseUrl;
        if (data.inboundMode !== undefined) {
            input.inboundMode = normalizeTelegramInboundMode(data.inboundMode);
        }
        if (typeof data.einsatzGroupChatId === 'string') input.einsatzGroupChatId = data.einsatzGroupChatId;
        if (typeof data.einsatzGroupLabel === 'string') input.einsatzGroupLabel = data.einsatzGroupLabel;
        if (typeof data.einsatzGroupInviteLink === 'string') input.einsatzGroupInviteLink = data.einsatzGroupInviteLink;
        if (data.einsatzGroupAlarmEnabled != null) input.einsatzGroupAlarmEnabled = data.einsatzGroupAlarmEnabled === true;
        const result = saveTelegramIntegration(input);
        if (!result.ok) {
            sendJson(res, 400, { ok: false, error: result.error }, cors);
            return true;
        }
        restartTelegramInbound();
        const pub = getTelegramIntegrationPublic();
        sendJson(res, 200, { ...pub, ok: true, saved: true }, cors);
        return true;
    }

    if (url === '/api/integrations/telegram/test-alarm' && req.method === 'POST') {
        const result = await sendTelegramTestAlarm();
        sendJson(res, result.ok ? 200 : 400, result, cors);
        return true;
    }

    if (url === NOTIFY_PATH && req.method === 'POST') {
        const capDenied = denyTransportWrite('telegram');
        if (capDenied) {
            sendJson(res, 403, capDenied, cors);
            return true;
        }
        const data = await readJsonBody(req);
        const recipientRaw = String(data.recipientAddress ?? data.recipient ?? '').trim();
        const telegramRaw =
            typeof data.telegramChatId === 'string' ? data.telegramChatId : undefined;
        const recipientAddress = resolveContactStorageKey(recipientRaw, telegramRaw);
        const messagePreview = String(data.messagePreview ?? data.message ?? '').trim();
        const senderLabel = typeof data.senderLabel === 'string' ? data.senderLabel : undefined;
        if (!recipientAddress) {
            sendJson(
                res,
                400,
                {
                    ok: false,
                    error: 'recipientAddress (0x + 64 Hex oder tg:<Chat-ID>) oder telegramChatId nötig.',
                },
                cors
            );
            return true;
        }
        const skipJournal = data.skipJournal === true;
        const result = await sendTelegramContactNotify({
            recipientAddress,
            messagePreview,
            senderLabel,
            skipJournal,
        });
        sendJson(
            res,
            200,
            {
                ok: true,
                delivered: result.delivered === true,
                skipped: result.skipped,
                error: result.error,
            },
            cors
        );
        return true;
    }

    if (url === '/api/integrations/telegram/journal' && req.method === 'GET') {
        const capDenied = denyTransportRead('telegram');
        if (capDenied) {
            sendJson(res, 403, capDenied, cors);
            return true;
        }
        const u = new URL(req.url || '', 'http://local');
        const contactKey = u.searchParams.get('contactKey')?.trim() || '';
        const chatId = u.searchParams.get('chatId')?.trim() || '';
        const limitRaw = u.searchParams.get('limit');
        const limit = limitRaw ? Number(limitRaw) : undefined;
        const entries = listTelegramJournalEntries({
            contactKey: contactKey || undefined,
            chatId: chatId || undefined,
            limit: Number.isFinite(limit) ? limit : undefined,
        });
        sendJson(res, 200, { ok: true, entries }, cors);
        return true;
    }

    if (url === '/api/integrations/telegram/webhook' && req.method === 'POST') {
        const data = await readJsonBody(req);
        const ingested = await ingestTelegramInboundUpdate(data);
        sendJson(
            res,
            200,
            { ok: true, stored: ingested.stored, reason: ingested.reason, commandReply: ingested.commandReply === true },
            cors
        );
        return true;
    }

    if (url === '/api/integrations/telegram/test-notify' && req.method === 'POST') {
        const data = await readJsonBody(req);
        const targetChatId = String(data.target_chat_id ?? data.targetChatId ?? '').trim();
        const result = await sendTelegramTestNotify(targetChatId);
        sendJson(res, result.ok ? 200 : 400, result, cors);
        return true;
    }

    if (url === '/api/integrations/telegram/group-alarm' && req.method === 'POST') {
        const data = await readJsonBody(req);
        const rawType = String(data.eventType ?? data.event_type ?? 'boss_alarm').trim().toLowerCase();
        const allowed: TelegramEinsatzGroupEventType[] = ['sos', 'team_update', 'boss_alarm', 'monitor'];
        const eventType = (allowed.includes(rawType as TelegramEinsatzGroupEventType)
            ? rawType
            : 'boss_alarm') as TelegramEinsatzGroupEventType;
        const seqRaw = data.seq ?? data.tgSeq;
        const seq = seqRaw != null && Number.isFinite(Number(seqRaw)) ? Number(seqRaw) : undefined;
        const bossShort = typeof data.bossShort === 'string' ? data.bossShort : undefined;
        const deviceLabel = typeof data.deviceLabel === 'string' ? data.deviceLabel : undefined;
        const teamLabel = typeof data.teamLabel === 'string' ? data.teamLabel : undefined;
        const result = await sendTelegramEinsatzGroupHint({
            eventType,
            seq,
            tgSeq: seq,
            bossShort,
            deviceLabel,
            teamLabel,
        });
        sendJson(
            res,
            result.ok ? 200 : 400,
            {
                ok: result.ok,
                delivered: result.delivered === true,
                skipped: result.skipped,
                error: result.error,
            },
            cors
        );
        return true;
    }

    return false;
}
