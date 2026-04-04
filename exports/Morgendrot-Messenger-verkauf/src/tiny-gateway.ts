/**
 * Gateway-Logik für Tiny-Arbeiter: HMAC-Verifikation, Heartbeat-Weiterleitung (transport: lora), Eintrag in Settlement-Queue.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CFG } from './config.js';
import { logger } from './logger.js';
import { appendSettlementEntry } from './settlement-queue.js';
import { getStreamsAdapter } from './streams-adapter.js';
import { recordHeartbeat } from './monitoring.js';

let _tinySecrets: Record<string, string> | null = null;

function loadTinySecrets(): Record<string, string> {
    if (_tinySecrets) return _tinySecrets;
    const out: Record<string, string> = {};
    const filePath = CFG.TINY_DEVICES_FILE?.trim();
    if (filePath) {
        try {
            const full = path.resolve(process.cwd(), filePath);
            if (fs.existsSync(full)) {
                const raw = fs.readFileSync(full, 'utf-8');
                const data = JSON.parse(raw) as Record<string, string>;
                if (typeof data === 'object') Object.assign(out, data);
            }
        } catch (e) {
            logger.warn('Tiny-Devices-Datei lesen: ' + (e as Error)?.message);
        }
    }
    for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('TINY_DEVICE_SECRET_') && value) {
            const id = key.slice('TINY_DEVICE_SECRET_'.length).trim();
            if (id) out[id] = value;
        }
    }
    _tinySecrets = out;
    return out;
}

/** HMAC-SHA256(deviceId + '|' + payloadStr + '|' + timestamp, secret) in Base64. */
export function computeTinyHmac(deviceId: string, payloadStr: string, timestamp: number, secretBase64: string): string {
    const secret = Buffer.from(secretBase64, 'base64');
    const msg = `${deviceId}|${payloadStr}|${timestamp}`;
    return crypto.createHmac('sha256', secret).update(msg, 'utf8').digest('base64');
}

/** Prüft, ob die Nachricht vom Tiny mit dem Geräte-Secret signiert wurde. */
export function verifyTinyHmac(deviceId: string, payloadStr: string, timestamp: number, hmacReceived: string): boolean {
    const secrets = loadTinySecrets();
    const secret = secrets[deviceId];
    if (!secret) return false;
    const expected = computeTinyHmac(deviceId, payloadStr, timestamp, secret);
    return crypto.timingSafeEqual(Buffer.from(expected, 'base64'), Buffer.from(hmacReceived, 'base64'));
}

export type TinyMessageResult = { ok: boolean; error?: string; forwarded?: boolean; queued?: boolean };

/**
 * Verarbeitet eine verifizierte Tiny-Nachricht: Heartbeat → Streams (transport: lora) + recordHeartbeat;
 * ticket_used → Eintrag in Settlement-Queue.
 */
export function processTinyMessage(deviceId: string, payload: unknown): TinyMessageResult {
    if (!deviceId || typeof payload !== 'object' || payload === null) {
        return { ok: false, error: 'deviceId und payload nötig.' };
    }
    const obj = payload as { type?: string; ticketObjectId?: string; eventId?: string; device?: string; ts?: number };
    const type = obj?.type;

    if (type === 'heartbeat') {
        const device = obj.device || deviceId;
        if (CFG.STREAMS_ANCHOR_ID && CFG.STREAMS_BRIDGE_URL) {
            const payloadStr = JSON.stringify({
                type: 'heartbeat',
                device,
                ts: obj.ts ?? Date.now(),
                transport: 'lora',
            });
            getStreamsAdapter()
                .publish(CFG.STREAMS_ANCHOR_ID, payloadStr)
                .then(() => {
                    if (CFG.MONITOR_DEVICES.includes(device)) recordHeartbeat(device, 'lora');
                })
                .catch((e) => logger.warn('Tiny Heartbeat weiterleiten: ' + (e as Error)?.message));
        }
        return { ok: true, forwarded: true };
    }

    if (type === 'ticket_used' && obj.ticketObjectId && obj.eventId) {
        try {
            appendSettlementEntry({
                ticketObjectId: obj.ticketObjectId,
                eventId: obj.eventId,
                deviceId,
            });
            return { ok: true, queued: true };
        } catch (e) {
            logger.warn('Settlement-Queue append: ' + (e as Error)?.message);
            return { ok: false, error: (e as Error)?.message };
        }
    }

    return { ok: true };
}
