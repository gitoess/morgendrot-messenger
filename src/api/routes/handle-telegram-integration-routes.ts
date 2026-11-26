/**
 * Telegram-Integration API (§ H.26 Phase A).
 */
import type http from 'node:http';
import {
    getTelegramIntegrationPublic,
    getTelegramIntegrationPublicAsync,
    readTelegramIntegrationConfig,
    saveTelegramIntegration,
    sendTelegramContactNotify,
    sendTelegramEinsatzGroupHint,
    sendTelegramTestAlarm,
    sendTelegramTestNotify,
    wipeTelegramIntegrationConfig,
    type SaveTelegramIntegrationInput,
    type TelegramEinsatzGroupEventType,
} from '../../integrations/telegram-integration.js';
import { resolveContactStorageKey } from '../../contact-labels.js';
import { ingestTelegramInboundUpdate, normalizeTelegramInboundMode } from '../../integrations/telegram-inbound.js';
import { restartTelegramInbound } from '../../integrations/telegram-inbound-poll.js';
import { clearTelegramJournalFile, listTelegramJournalEntries } from '../../integrations/telegram-journal.js';
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

    if (url === '/api/integrations/telegram/wipe' && req.method === 'POST') {
        const result = wipeTelegramIntegrationConfig();
        if (!result.ok) {
            sendJson(res, 400, { ok: false, error: result.error }, cors);
            return true;
        }
        const journal = clearTelegramJournalFile();
        restartTelegramInbound();
        const pub = getTelegramIntegrationPublic();
        sendJson(
            res,
            200,
            {
                ...pub,
                ok: true,
                wiped: true,
                journalCleared: journal.removed,
                message:
                    'Telegram-Runtime (Bot-Token, Chat-IDs, Gruppe) geleert' +
                    (journal.removed ? '; lokales Journal entfernt.' : '; kein Journal-File vorhanden.'),
            },
            cors
        );
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
            typeof data.telegramChatId === 'string'
                ? data.telegramChatId
                : typeof data.targetChatId === 'string'
                  ? data.targetChatId
                  : typeof data.target_chat_id === 'string'
                    ? data.target_chat_id
                    : undefined;
        const recipientAddress = resolveContactStorageKey(recipientRaw, telegramRaw);
        const messagePreview = String(data.messagePreview ?? data.message ?? '').trim();
        const senderLabel = typeof data.senderLabel === 'string' ? data.senderLabel : undefined;
        const skipJournal = data.skipJournal === true;
        const photoBase64 =
            typeof data.photoBase64 === 'string'
                ? data.photoBase64
                : typeof data.photo_base64 === 'string'
                  ? data.photo_base64
                  : undefined;
        const acknowledgeUnencryptedMedia =
            data.acknowledgeUnencryptedMedia === true || data.acknowledge_unencrypted_media === true;
        const audienceRaw = String(data.audience ?? 'contact').trim().toLowerCase();
        const audience =
            audienceRaw === 'self' || audienceRaw === 'both' || audienceRaw === 'contact'
                ? audienceRaw
                : 'contact';
        const wantContact = audience === 'contact' || audience === 'both';
        const wantAdmin = audience === 'self' || audience === 'both' || data.notifyAdmin === true;
        const targetChatId =
            typeof telegramRaw === 'string' && telegramRaw.trim() ? telegramRaw.trim() : undefined;

        /** Optionale CC-Liste (max 5) — weitere Chat-IDs, nicht die Einsatz-Alarmgruppe. */
        const EXTRA_CAP = 5;
        const extraRaw = data.extraChatIds ?? data.extra_chat_ids;
        const extraList: string[] = [];
        if (Array.isArray(extraRaw)) {
            for (const x of extraRaw) {
                const id = String(x ?? '').trim().replace(/^tg:/i, '');
                if (/^-?\d{1,20}$/.test(id) && !extraList.includes(id)) extraList.push(id);
                if (extraList.length >= EXTRA_CAP) break;
            }
        } else if (typeof extraRaw === 'string' && extraRaw.trim()) {
            for (const part of extraRaw.split(/[,;\n]+/)) {
                const id = part.trim().replace(/^tg:/i, '');
                if (/^-?\d{1,20}$/.test(id) && !extraList.includes(id)) extraList.push(id);
                if (extraList.length >= EXTRA_CAP) break;
            }
        }

        const hasNotifyTarget =
            Boolean(recipientAddress) ||
            Boolean(targetChatId) ||
            wantAdmin ||
            extraList.length > 0;
        if (!hasNotifyTarget) {
            sendJson(
                res,
                400,
                {
                    ok: false,
                    error:
                        'Notify-Ziel fehlt: recipientAddress / telegramChatId, audience self/both (Admin-Chat-ID) oder extraChatIds.',
                },
                cors
            );
            return true;
        }
        if (wantContact && !recipientAddress && !targetChatId && !wantAdmin && extraList.length === 0) {
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

        let deliveredContact = false;
        let deliveredAdmin = false;
        const skips: string[] = [];
        let lastError: string | undefined;

        if (wantContact && (recipientAddress || targetChatId)) {
            const result = await sendTelegramContactNotify({
                recipientAddress: recipientAddress || `tg:${targetChatId}`,
                messagePreview,
                senderLabel,
                skipJournal,
                targetChatId,
                photoBase64,
                acknowledgeUnencryptedMedia,
            });
            if (result.delivered) deliveredContact = true;
            else if (result.skipped) skips.push(result.skipped);
            else if (result.error) lastError = result.error;
        } else if (wantContact && !recipientAddress && !targetChatId) {
            skips.push('Kontakt-Hinweis: keine 0x / Chat-ID.');
        }

        if (wantAdmin) {
            const cfg = readTelegramIntegrationConfig();
            const adminId = cfg?.adminChatId?.trim() || '';
            if (!adminId) {
                skips.push('Admin-Chat-ID fehlt (Einstellungen → Telegram).');
            } else {
                const result = await sendTelegramContactNotify({
                    recipientAddress: recipientAddress || `tg:${adminId}`,
                    messagePreview,
                    senderLabel: senderLabel || 'Morgendrot',
                    skipJournal: true,
                    targetChatId: adminId,
                });
                if (result.delivered) deliveredAdmin = true;
                else if (result.skipped) skips.push(result.skipped);
                else if (result.error) lastError = result.error;
            }
        }

        let deliveredExtra = 0;
        for (const id of extraList) {
            if (targetChatId && id === targetChatId) continue;
            const result = await sendTelegramContactNotify({
                recipientAddress: `tg:${id}`,
                messagePreview,
                senderLabel: senderLabel || 'Morgendrot',
                skipJournal: true,
                targetChatId: id,
            });
            if (result.delivered) deliveredExtra += 1;
            else if (result.skipped) skips.push(`CC ${id}: ${result.skipped}`);
            else if (result.error) lastError = result.error;
        }

        const delivered = deliveredContact || deliveredAdmin || deliveredExtra > 0;
        sendJson(
            res,
            delivered || !lastError ? 200 : 400,
            {
                ok: delivered || !lastError,
                delivered,
                deliveredContact,
                deliveredAdmin,
                deliveredExtra,
                skipped: skips.length ? skips.join(' · ') : undefined,
                error: lastError,
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
