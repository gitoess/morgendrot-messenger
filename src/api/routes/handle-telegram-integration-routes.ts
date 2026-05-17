/**
 * Telegram-Integration API (§ H.26 Phase A).
 */
import type http from 'node:http';
import {
    getTelegramIntegrationPublic,
    getTelegramIntegrationPublicAsync,
    saveTelegramIntegration,
    sendTelegramContactNotify,
    sendTelegramTestAlarm,
    sendTelegramTestNotify,
    type SaveTelegramIntegrationInput,
} from '../../integrations/telegram-integration.js';
import { resolveContactStorageKey } from '../../contact-labels.js';
import { ingestTelegramInboundUpdate, normalizeTelegramInboundMode } from '../../integrations/telegram-inbound.js';
import { restartTelegramInbound } from '../../integrations/telegram-inbound-poll.js';
import { listTelegramJournalEntries } from '../../integrations/telegram-journal.js';
import type { SendJsonFn } from './api-route-types.js';

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
        const result = await sendTelegramContactNotify({ recipientAddress, messagePreview, senderLabel });
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
        const ingested = ingestTelegramInboundUpdate(data);
        sendJson(
            res,
            200,
            { ok: true, stored: ingested.stored, reason: ingested.reason },
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

    return false;
}
