/**
 * Monitoring: Heartbeat („ich bin online“) + Offline-Alarm + Sensor-Grenzwert + Eskalation.
 * Optional: Lock sendet Heartbeat/Sensor via Streams; Monitor prüft Timeout und Temperatur.
 */
import { CFG } from './config.js';
import { HEARTBEAT_INTERVAL_MIN_MS } from './shared/heartbeat-presets.js';
import { logger } from './logger.js';
import { appendAuditEvent } from './audit-log.js';
import { getStreamsAdapter } from './streams-adapter.js';
import fs from 'node:fs';
import path from 'node:path';

/** Wie die Heartbeat-Nachricht ankam: direkt (Node) oder via LoRa/Gateway. */
export type HeartbeatTransport = 'lora' | 'internet';

export type MonitorDeviceStatus = {
    device: string;
    lastSeen: number;
    status: 'online' | 'offline' | 'alarm';
    purgeable?: boolean;
    /** Letzter Transport-Pfad (lora | internet) für Dashboard-Anzeige. */
    lastTransport?: HeartbeatTransport;
    lastSensor?: { temp?: number; humidity?: number; shock?: number; lat?: number; lon?: number; light?: number; ts: number };
};

/** Sendet Heartbeat via Streams (Lock: „ich bin online“). transport = wie die Nachricht unterwegs ist (default: internet). */
export function sendHeartbeat(deviceId: string, transport: HeartbeatTransport = 'internet'): void {
    if (!CFG.ENABLE_HEARTBEAT || !CFG.STREAMS_ANCHOR_ID || !CFG.STREAMS_BRIDGE_URL) return;
    const payload = JSON.stringify({
        type: 'heartbeat',
        device: deviceId,
        ts: Date.now(),
        transport: transport === 'lora' ? 'lora' : 'internet',
    });
    getStreamsAdapter()
        .publish(CFG.STREAMS_ANCHOR_ID, payload)
        .catch((e) => logger.warn(
            'Heartbeat senden fehlgeschlagen: ' + (e as Error)?.message +
            '. STREAMS_BRIDGE_URL und STREAMS_ANCHOR_ID prüfen; Bridge erreichbar?'
        ));
}

/** Startet Heartbeat-Loop (Lock). Nutzt setTimeout-Chain; Intervall wird bei jedem Takt aus CFG gelesen (kein Neustart nötig). */
export function startHeartbeatLoop(deviceId: string): void {
    if (!CFG.ENABLE_HEARTBEAT || !CFG.STREAMS_ANCHOR_ID) return;
    const ms = Math.max(HEARTBEAT_INTERVAL_MIN_MS, CFG.HEARTBEAT_INTERVAL_MS);
    logger.info(`Heartbeat aktiv: alle ${ms / 1_000}s via Streams (feeless).`);
    sendHeartbeat(deviceId);
    const schedule = () => {
        const nextMs = Math.max(HEARTBEAT_INTERVAL_MIN_MS, CFG.HEARTBEAT_INTERVAL_MS);
        setTimeout(async () => {
            try { sendHeartbeat(deviceId); } catch {}
            schedule();
        }, nextMs);
    };
    schedule();
}

export type HeartbeatStateEntry = { lastSeen: number; transport?: HeartbeatTransport };

/** Liest letzten Heartbeat pro Gerät (kompatibel mit alter Format: deviceId -> number). */
function loadHeartbeatState(filePath: string): Record<string, HeartbeatStateEntry> {
    if (!filePath) return {};
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw) as Record<string, number | HeartbeatStateEntry>;
        if (typeof data !== 'object' || data === null) return {};
        const out: Record<string, HeartbeatStateEntry> = {};
        for (const [k, v] of Object.entries(data)) {
            if (typeof v === 'number') out[k] = { lastSeen: v };
            else if (v && typeof v.lastSeen === 'number') out[k] = { lastSeen: v.lastSeen, transport: v.transport as HeartbeatTransport | undefined };
        }
        return out;
    } catch {
        return {};
    }
}

/** Speichert letzten Heartbeat (inkl. transport). */
function saveHeartbeatState(filePath: string, state: Record<string, HeartbeatStateEntry>): void {
    if (!filePath) return;
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(state, null, 0), 'utf-8');
        try { fs.chmodSync(filePath, 0o600); } catch {} // Nur Eigentümer lesbar/schreibbar (Unix)
    } catch (e) {
        logger.warn('Heartbeat-State speichern fehlgeschlagen: ' + (e as Error)?.message);
    }
}

/** Geräte, für die bereits Alarm ausgelöst wurde (Cooldown, kein Spam). */
const alarmedDevices = new Set<string>();
/** Eskalation: Zeitpunkt des ersten Alarms pro Gerät (für Level 2/3). */
const escalationFirstAlarm = new Map<string, number>();
/** Bereits an Level 2 eskaliert (kein Spam). */
const escalationL2Sent = new Set<string>();
/** Bereits an Level 3 eskaliert (kein Spam). */
const escalationL3Sent = new Set<string>();
/** Bereits als purgeable geloggt (kein Spam). */
const purgeableLogged = new Set<string>();

function loadSensorState(filePath: string): Record<string, { temp?: number; humidity?: number; shock?: number; lat?: number; lon?: number; light?: number; ts: number }> {
    if (!filePath) return {};
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw) as Record<string, unknown>;
        return typeof data === 'object' && data !== null ? (data as Record<string, { temp?: number; humidity?: number; shock?: number; lat?: number; lon?: number; light?: number; ts: number }>) : {};
    } catch {
        return {};
    }
}

function saveSensorState(filePath: string, state: Record<string, { temp?: number; humidity?: number; shock?: number; lat?: number; lon?: number; light?: number; ts: number }>): void {
    if (!filePath) return;
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(state, null, 0), 'utf-8');
        try { fs.chmodSync(filePath, 0o600); } catch {} // Nur Eigentümer lesbar/schreibbar (Unix)
    } catch (e) {
        logger.warn('Sensor-State speichern fehlgeschlagen: ' + (e as Error)?.message);
    }
}

/** Prüft Offline-Status und triggert Alarm bei Timeout. */
export async function checkOfflineAndAlarm(): Promise<void> {
    const devices = CFG.MONITOR_DEVICES;
    if (!devices.length) return;
    const timeoutMs = CFG.MONITOR_OFFLINE_TIMEOUT_MS;
    const statePath = CFG.MONITOR_STATE_FILE || '';
    const state = loadHeartbeatState(statePath);

    const now = Date.now();
    for (const deviceId of devices) {
        const entry = state[deviceId];
        const lastSeen = entry?.lastSeen ?? 0;
        const offlineSince = now - lastSeen;
        if (lastSeen > 0 && offlineSince > timeoutMs) {
            if (alarmedDevices.has(deviceId)) continue; // Bereits alarmiert
            alarmedDevices.add(deviceId);
            const msg = `Gerät ${deviceId.slice(0, 14)}… offline seit ${Math.round(offlineSince / 60_000)} Min.`;
            logger.warn(`\x1b[33m[OFFLINE-ALARM] ${msg}\x1b[0m`);
            await triggerAlarm(deviceId, msg);
        } else if (lastSeen > 0) {
            alarmedDevices.delete(deviceId); // Wieder online → Cooldown zurücksetzen
            escalationFirstAlarm.delete(deviceId);
            escalationL2Sent.delete(deviceId);
            escalationL3Sent.delete(deviceId);
            purgeableLogged.delete(deviceId);
        }
        // Purgeable: nach MONITOR_PURGE_AFTER_DAYS Inaktivität → Audit-Event
        const purgeMs = CFG.MONITOR_PURGE_AFTER_DAYS > 0 ? CFG.MONITOR_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000 : 0;
        if (purgeMs > 0 && lastSeen > 0 && offlineSince >= purgeMs && !purgeableLogged.has(deviceId)) {
            purgeableLogged.add(deviceId);
            const days = Math.round(offlineSince / (24 * 60 * 60 * 1000));
            appendAuditEvent({ type: 'purge', device: deviceId, message: `Gerät ${deviceId.slice(0, 14)}… seit ${days} Tagen inaktiv – purgebar.` });
        }
    }
    await checkEscalation();
}

/** Triggert Alarm (Log + Webhook Level 1 + ggf. Eskalation Level 2/3). */
async function triggerAlarm(deviceId: string, message: string, level: 1 | 2 | 3 = 1): Promise<void> {
    const payload = { device: deviceId, message, ts: Date.now(), level };
    appendAuditEvent({ type: level > 1 ? 'escalation' : 'alarm', device: deviceId, message, level });
    logger.warn(`\x1b[33m[ALARM L${level}] ${message}\x1b[0m`);

    const webhook1 = CFG.MONITOR_ALARM_WEBHOOK_URL?.trim();
    const webhook2 = CFG.MONITOR_ESCALATION_WEBHOOK_2?.trim();
    const webhook3 = CFG.MONITOR_ESCALATION_WEBHOOK_3?.trim();
    const delayMs = CFG.MONITOR_ESCALATION_DELAY_MS;

    if (level === 1 && webhook1) {
        try {
            const res = await fetch(webhook1, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) logger.warn('Alarm-Webhook L1 fehlgeschlagen: ' + res.status);
        } catch (e) {
            logger.warn('Alarm-Webhook L1: ' + (e as Error)?.message);
        }
        escalationFirstAlarm.set(deviceId, Date.now());
    } else if (level === 2 && webhook2) {
        try {
            const res = await fetch(webhook2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) logger.warn('Eskalation L2 fehlgeschlagen: ' + res.status);
        } catch (e) {
            logger.warn('Eskalation L2: ' + (e as Error)?.message);
        }
    } else if (level === 3 && webhook3) {
        try {
            const res = await fetch(webhook3, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) logger.warn('Eskalation L3 fehlgeschlagen: ' + res.status);
        } catch (e) {
            logger.warn('Eskalation L3: ' + (e as Error)?.message);
        }
    }
}

/** Prüft Eskalation: Nach MONITOR_ESCALATION_DELAY_MS Level 2, nach 2× Delay Level 3. */
async function checkEscalation(): Promise<void> {
    const delay = CFG.MONITOR_ESCALATION_DELAY_MS;
    if (delay < 60000 || (!CFG.MONITOR_ESCALATION_WEBHOOK_2 && !CFG.MONITOR_ESCALATION_WEBHOOK_3)) return;
    const now = Date.now();
    for (const [deviceId, firstAt] of escalationFirstAlarm) {
        if (!alarmedDevices.has(deviceId)) continue;
        const elapsed = now - firstAt;
        if (elapsed >= delay * 2 && CFG.MONITOR_ESCALATION_WEBHOOK_3 && !escalationL3Sent.has(deviceId)) {
            escalationL3Sent.add(deviceId);
            await triggerAlarm(deviceId, `Eskalation L3: Gerät ${deviceId.slice(0, 14)}… weiterhin alarmiert seit ${Math.round(elapsed / 60_000)} Min.`, 3);
        } else if (elapsed >= delay && CFG.MONITOR_ESCALATION_WEBHOOK_2 && !escalationL2Sent.has(deviceId)) {
            escalationL2Sent.add(deviceId);
            await triggerAlarm(deviceId, `Eskalation L2: Gerät ${deviceId.slice(0, 14)}… alarmiert seit ${Math.round(elapsed / 60_000)} Min.`, 2);
        }
    }
}

/** Speichert Sensor-Daten und prüft Grenzwerte. Bei Überschreitung → Alarm. */
export function recordSensor(
    deviceId: string,
    data: { temp?: number; humidity?: number; shock?: number; lat?: number; lon?: number; light?: number; ts: number }
): void {
    if (!deviceId || typeof deviceId !== 'string') return;
    if (!CFG.MONITOR_DEVICES.includes(deviceId)) return;
    recordHeartbeat(deviceId); // Sensor = Gerät online
    const sensorPath = CFG.MONITOR_SENSOR_STATE_FILE || '';
    if (sensorPath) {
        const state = loadSensorState(sensorPath);
        state[deviceId] = { ...data, ts: data.ts || Date.now() };
        saveSensorState(sensorPath, state);
    }
    const maxT = CFG.MONITOR_SENSOR_MAX_TEMP;
    const minT = CFG.MONITOR_SENSOR_MIN_TEMP;
    const temp = typeof data.temp === 'number' ? data.temp : NaN;
    if (!Number.isNaN(temp)) {
        if (!Number.isNaN(maxT) && temp > maxT && !alarmedDevices.has(deviceId)) {
            alarmedDevices.add(deviceId);
            const msg = `Gerät ${deviceId.slice(0, 14)}… Temperatur ${temp.toFixed(1)}°C > ${maxT}°C (Kühlkette!).`;
            logger.warn(`\x1b[33m[SENSOR-ALARM] ${msg}\x1b[0m`);
            triggerAlarm(deviceId, msg);
        } else if (!Number.isNaN(minT) && temp < minT && !alarmedDevices.has(deviceId)) {
            alarmedDevices.add(deviceId);
            const msg = `Gerät ${deviceId.slice(0, 14)}… Temperatur ${temp.toFixed(1)}°C < ${minT}°C (Kühlkette!).`;
            logger.warn(`\x1b[33m[SENSOR-ALARM] ${msg}\x1b[0m`);
            triggerAlarm(deviceId, msg);
        } else if ((Number.isNaN(maxT) || temp <= maxT) && (Number.isNaN(minT) || temp >= minT)) {
            alarmedDevices.delete(deviceId);
            escalationFirstAlarm.delete(deviceId);
            escalationL2Sent.delete(deviceId);
            escalationL3Sent.delete(deviceId);
        }
    }
}

/** Liefert Status aller überwachten Geräte (für API/Dashboard). */
export function getMonitorStatus(): MonitorDeviceStatus[] {
    const devices = CFG.MONITOR_DEVICES;
    const statePath = CFG.MONITOR_STATE_FILE || '';
    const sensorPath = CFG.MONITOR_SENSOR_STATE_FILE || '';
    const timeoutMs = CFG.MONITOR_OFFLINE_TIMEOUT_MS;
    const purgeDays = CFG.MONITOR_PURGE_AFTER_DAYS;
    const purgeMs = purgeDays > 0 ? purgeDays * 24 * 60 * 60 * 1000 : 0;
    const heartbeatState = loadHeartbeatState(statePath);
    const sensorState = loadSensorState(sensorPath);
    const now = Date.now();
    return devices.map((device) => {
        const entry = heartbeatState[device];
        const lastSeen = entry?.lastSeen ?? 0;
        const offlineSince = lastSeen > 0 ? now - lastSeen : 0;
        let status: 'online' | 'offline' | 'alarm' = 'online';
        if (lastSeen === 0) status = 'offline';
        else if (offlineSince > timeoutMs || alarmedDevices.has(device)) status = 'alarm';
        else if (offlineSince > timeoutMs * 0.5) status = 'offline';
        const purgeable = purgeMs > 0 && lastSeen > 0 && offlineSince >= purgeMs;
        const lastSensor = sensorState[device];
        return {
            device,
            lastSeen,
            status,
            purgeable,
            lastTransport: entry?.transport,
            lastSensor: lastSensor
                ? {
                      temp: lastSensor.temp,
                      humidity: lastSensor.humidity,
                      shock: lastSensor.shock,
                      lat: lastSensor.lat,
                      lon: lastSensor.lon,
                      light: lastSensor.light,
                      ts: lastSensor.ts,
                  }
                : undefined,
        };
    });
}

/** Aktualisiert Heartbeat-State für Device (wird vom Monitor bei empfangener Heartbeat-Nachricht aufgerufen). transport = wie die Nachricht ankam (lora | internet). */
export function recordHeartbeat(deviceId: string, transport?: HeartbeatTransport): void {
    if (!deviceId || typeof deviceId !== 'string') return;
    if (!CFG.MONITOR_DEVICES.includes(deviceId)) return; // Nur überwachte Geräte
    const statePath = CFG.MONITOR_STATE_FILE || '';
    if (!statePath) return;
    const state = loadHeartbeatState(statePath);
    const t = transport === 'lora' ? 'lora' : 'internet';
    state[deviceId] = { lastSeen: Date.now(), transport: t };
    saveHeartbeatState(statePath, state);
}

/** Monitor-Modus: Pollt Streams nach Heartbeats, prüft Offline, triggert Alarm. */
export async function runMonitorMode(): Promise<void> {
    const devices = CFG.MONITOR_DEVICES;
    if (!devices.length) {
        logger.warn('MONITOR_DEVICES leer – keine Geräte zu überwachen.');
        return;
    }
    if (!CFG.STREAMS_ANCHOR_ID || !CFG.STREAMS_BRIDGE_URL) {
        logger.warn('STREAMS_ANCHOR_ID und STREAMS_BRIDGE_URL nötig für Monitor.');
        return;
    }
    logger.info(`Monitor aktiv: ${devices.length} Gerät(e), Timeout ${CFG.MONITOR_OFFLINE_TIMEOUT_MS / 60_000} Min.`);

    getStreamsAdapter().startListening(CFG.STREAMS_ANCHOR_ID, (msg) => {
        try {
            const payload = msg.payload ?? '';
            const obj = JSON.parse(payload) as {
                type?: string;
                device?: string;
                transport?: string;
                temp?: number;
                humidity?: number;
                shock?: number;
                gps?: { lat?: number; lon?: number };
                light?: number;
                ts?: number;
            };
            if (obj?.type === 'heartbeat' && obj?.device) {
                const transport = obj.transport === 'lora' ? 'lora' : 'internet';
                recordHeartbeat(obj.device, transport);
            } else if (obj?.type === 'sensor' && obj?.device) {
                const ts = typeof obj.ts === 'number' ? obj.ts : Date.now();
                const gps = obj.gps as { lat?: number; lon?: number } | undefined;
                recordSensor(obj.device, {
                    temp: obj.temp,
                    humidity: obj.humidity,
                    shock: obj.shock,
                    lat: gps?.lat,
                    lon: gps?.lon,
                    light: obj.light,
                    ts,
                });
            }
        } catch {
            // keine Heartbeat/Sensor-Nachricht
        }
    });

    setInterval(() => checkOfflineAndAlarm(), CFG.MONITOR_CHECK_INTERVAL_MS);
    await checkOfflineAndAlarm();
    // Prozess am Leben halten
    await new Promise<void>(() => {});
}
