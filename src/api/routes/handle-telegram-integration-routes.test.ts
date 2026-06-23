import http from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { handleTelegramIntegrationRoutes } from './handle-telegram-integration-routes.js';

function postJson(
    path: string,
    body: Record<string, unknown>
): Promise<{ handled: boolean; status: number; json: Record<string, unknown> }> {
    return new Promise((resolve, reject) => {
        let status = 0;
        let raw = '';
        const res = {
            writeHead: (code: number) => {
                status = code;
            },
            end: (chunk?: string) => {
                raw = chunk ?? '';
                try {
                    resolve({
                        handled: true,
                        status,
                        json: JSON.parse(raw || '{}') as Record<string, unknown>,
                    });
                } catch (e) {
                    reject(e);
                }
            },
        } as unknown as http.ServerResponse;

        const payload = JSON.stringify(body);
        const stream = Readable.from([payload]);
        const req = stream as unknown as http.IncomingMessage;
        req.method = 'POST';

        void handleTelegramIntegrationRoutes(req, res, path, {}, (r, code, data) => {
            r.writeHead(code);
            r.end(JSON.stringify(data));
        }).then((handled) => {
            if (!handled) resolve({ handled: false, status: 404, json: {} });
        });
    });
}

describe('handleTelegramIntegrationRoutes', () => {
    it('bearbeitet POST /api/integrations/telegram/notify (tg:-Kontakt)', async () => {
        const r = await postJson('/api/integrations/telegram/notify', {
            recipientAddress: 'tg:1156058618',
            messagePreview: 'Test',
        });
        expect(r.handled).toBe(true);
        expect(r.status).toBe(200);
        expect(r.json.ok).toBe(true);
    });

    it('bearbeitet POST /api/integrations/telegram/group-alarm', async () => {
        const r = await postJson('/api/integrations/telegram/group-alarm', {
            eventType: 'boss_alarm',
        });
        expect(r.handled).toBe(true);
        expect(r.status).toBe(200);
        expect(r.json.ok).toBe(true);
    });
});
