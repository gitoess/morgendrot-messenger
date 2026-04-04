import http from 'node:http';
import { URL } from 'node:url';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Kleiner Zwischen-Webhook: Morgendrot → Telegram.
 *
 * Erwartet POST JSON:
 * { device?: string; message?: string; ts?: number; level?: 1|2|3 }
 *
 * und schickt eine formatierte Nachricht an Telegram:
 * https://api.telegram.org/bot<TG_BOT_TOKEN>/sendMessage
 *
 * Konfiguration (Umgebungsvariablen):
 * - TG_BOT_TOKEN   – Bot-Token von @BotFather
 * - TG_CHAT_ID     – Chat-ID (User/Gruppe), die Nachrichten bekommen soll
 * - TG_WEBHOOK_PORT (optional) – Port für diesen Server (Standard 8787)
 *
 * MONITOR_ALARM_WEBHOOK_URL in Morgendrot zeigt auf:
 *   http://127.0.0.1:8787/morgendrot-telegram
 */

const PORT = Number(process.env.TG_WEBHOOK_PORT || 8787);
const TOKEN = process.env.TG_BOT_TOKEN || '';
const CHAT_ID = process.env.TG_CHAT_ID || '';

if (!TOKEN || !CHAT_ID) {
    console.error('Bitte TG_BOT_TOKEN und TG_CHAT_ID in der Umgebung setzen.');
    process.exit(1);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (req.method !== 'POST' || url.pathname !== '/morgendrot-telegram') {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });

    req.on('end', async () => {
        try {
            const payload = JSON.parse(body || '{}') as {
                device?: string;
                message?: string;
                ts?: number;
                level?: number;
            };

            const device = payload.device || 'unbekanntes Gerät';
            const msg = payload.message || 'Kein Text';
            const level = payload.level ?? 1;
            const ts = payload.ts ? new Date(payload.ts).toLocaleString('de-DE') : new Date().toLocaleString('de-DE');

            const text =
                `⚠️ Morgendrot Alarm L${level}\n` +
                `Gerät: ${device}\n` +
                `Zeit: ${ts}\n` +
                `Meldung: ${msg}`;

            const tgUrl = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
            const resp = await fetch(tgUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text }),
            });

            if (!resp.ok) {
                console.error('Telegram sendMessage fehlgeschlagen:', resp.status, await resp.text());
                res.writeHead(500);
                res.end('telegram error');
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        } catch (e: any) {
            console.error('Fehler im Telegram-Webhook:', e?.message || e);
            res.writeHead(500);
            res.end('error');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Morgendrot→Telegram Webhook läuft auf http://127.0.0.1:${PORT}/morgendrot-telegram`);
});

