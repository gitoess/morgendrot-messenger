import http from 'node:http';
import { URL } from 'node:url';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Kleiner Zwischen-Webhook: Morgendrot → Telegram (§ H.26).
 *
 * Kanal A — Alarm: POST /morgendrot-telegram/alarm (Legacy: /morgendrot-telegram)
 * Kanal B — Kontakt: POST /morgendrot-telegram/notify
 */

import {
    formatTelegramAlarmText,
    formatTelegramNotifyText,
    loadTelegramRelayCredentials,
    sendTelegramMessage,
    truncateTelegramMessagePreview,
} from '../src/integrations/telegram-integration.js';

const PORT = Number(process.env.TG_WEBHOOK_PORT || 8787);

function isLocalhostAddress(addr: string | undefined): boolean {
    const a = (addr || '').replace(/^::ffff:/, '');
    return a === '127.0.0.1' || a === '::1' || a === 'localhost';
}

function checkRelaySecret(req: http.IncomingMessage, expected: string): boolean {
    if (!expected) return true;
    const got = String(req.headers['x-morgendrot-relay-secret'] ?? '').trim();
    return got === expected;
}

function rejectBotTokenInBody(body: string, res: http.ServerResponse): boolean {
    if (body.includes('bot_token') || body.includes('"token"')) {
        console.warn('Telegram-Relay: bot_token im Body abgelehnt.');
        res.writeHead(400);
        res.end('bot_token not allowed in body');
        return true;
    }
    return false;
}

async function handleAlarmPost(
    res: http.ServerResponse,
    body: string,
    creds: { token: string; chatId: string }
): Promise<void> {
    const payload = JSON.parse(body || '{}') as {
        device?: string;
        message?: string;
        ts?: number;
        level?: number;
    };
    const text = formatTelegramAlarmText(payload);
    const target = creds.chatId;
    if (!target) {
        res.writeHead(503);
        res.end('admin chat id missing');
        return;
    }
    const result = await sendTelegramMessage(creds.token, target, text);
    if (!result.ok) {
        console.error('Telegram sendMessage fehlgeschlagen:', result.error);
        res.writeHead(500);
        res.end('telegram error');
        return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
}

async function handleNotifyPost(
    res: http.ServerResponse,
    body: string,
    creds: { token: string }
): Promise<void> {
    const payload = JSON.parse(body || '{}') as {
        target_chat_id?: string;
        message_preview?: string;
        sender_label?: string;
    };
    const target = String(payload.target_chat_id ?? '').trim();
    if (!target) {
        res.writeHead(400);
        res.end('target_chat_id required');
        return;
    }
    const preview = truncateTelegramMessagePreview(String(payload.message_preview ?? ''));
    const senderLabel = String(payload.sender_label ?? 'Morgendrot').trim() || 'Morgendrot';
    const text = formatTelegramNotifyText(senderLabel, preview);
    const result = await sendTelegramMessage(creds.token, target, text);
    if (!result.ok) {
        console.error('Telegram notify fehlgeschlagen:', result.error);
        res.writeHead(500);
        res.end('telegram error');
        return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
}

const credsAtStart = loadTelegramRelayCredentials();
if (!credsAtStart?.token) {
    console.error(
        'Bitte Telegram in Integrationen (Runtime) speichern oder TG_BOT_TOKEN in .env setzen.'
    );
    process.exit(1);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const isAlarmPath =
        url.pathname === '/morgendrot-telegram' || url.pathname === '/morgendrot-telegram/alarm';
    const isNotifyPath = url.pathname === '/morgendrot-telegram/notify';

    if (req.method !== 'POST' || (!isAlarmPath && !isNotifyPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    if (!isLocalhostAddress(req.socket?.remoteAddress)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
    }

    const creds = loadTelegramRelayCredentials();
    if (!creds?.token) {
        res.writeHead(503);
        res.end('not configured');
        return;
    }

    if (!checkRelaySecret(req, creds.relaySecret)) {
        res.writeHead(401);
        res.end('unauthorized');
        return;
    }

    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });

    req.on('end', () => {
        if (rejectBotTokenInBody(body, res)) return;
        const run = isNotifyPath
            ? handleNotifyPost(res, body, { token: creds.token })
            : handleAlarmPost(res, body, creds);
        void run.catch((e: unknown) => {
            console.error('Fehler im Telegram-Webhook:', e instanceof Error ? e.message : e);
            res.writeHead(500);
            res.end('error');
        });
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(
        `Morgendrot→Telegram Relay: http://127.0.0.1:${PORT}/morgendrot-telegram/alarm | /notify`
    );
});
