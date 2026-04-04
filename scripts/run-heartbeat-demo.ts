/**
 * Demo: Echter Heartbeat über Streams (Boss + Arbeiter).
 * 1. Startet die Streams-Mock-Bridge (oder nutzt laufende auf PORT).
 * 2. Erstellt einen Kanal und gibt Env für Boss aus.
 * 3. Simuliert den Arbeiter: sendet Heartbeats an die Bridge.
 * 4. Optional: fragt /api/monitor-status ab (wenn Backend mit gleicher Bridge läuft).
 *
 * Ablauf:
 * - Terminal 1: npm run demo:heartbeat  (startet Mock, erstellt Kanal, sendet Heartbeats)
 * - Terminal 2: STREAMS_BRIDGE_URL=http://127.0.0.1:9343 STREAMS_ANCHOR_ID=<aus Ausgabe> \
 *               MONITOR_DEVICES=0x0000000000000000000000000000000000000000000000000000000000000001 \
 *               ENABLE_MONITOR=true MONITOR_STATE_FILE=./tmp/demo-state.json npm run start:secrets
 * - In UI (Boss): Bridge-URL ist schon gesetzt, Kanal existiert – MONITOR_DEVICES auf 0x00..01 setzen.
 *   Oder Backend mit obigen Env starten, dann zeigt "Geräte-Status" nach ~5s das Gerät als online.
 *
 * Usage: npx tsx scripts/run-heartbeat-demo.ts [BRIDGE_PORT] [API_URL] [WORKER_ADDRESS]
 * Default: BRIDGE_PORT=9343, API_URL=leer, WORKER_ADDRESS=0x00..01 (64 Zeichen)
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || process.argv[2] || '9343', 10);
const API_URL = process.env.API_URL || process.argv[3] || '';
const WORKER_ADDRESS = process.argv[4] || '0x' + '0'.repeat(63) + '1';
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;

let bridgeProcess: ReturnType<typeof spawn> | null = null;

async function startBridge(): Promise<boolean> {
    return new Promise((resolve) => {
        bridgeProcess = spawn('npx', ['tsx', 'scripts/streams-bridge-mock.ts', String(BRIDGE_PORT)], {
            cwd: path.resolve(process.cwd()),
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
        });
        let ok = false;
        bridgeProcess.stdout?.on('data', (chunk: Buffer) => {
            if (chunk.toString().includes('Streams-Bridge-Mock')) ok = true;
        });
        bridgeProcess.stderr?.on('data', (d: Buffer) => process.stderr.write(d));
        setTimeout(() => resolve(ok), 1500);
    });
}

async function createChannel(): Promise<string> {
    const res = await fetch(`${BRIDGE_URL}/streams/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: 'boss-demo' }),
    });
    if (!res.ok) throw new Error(`Bridge create: ${res.status}`);
    const data = (await res.json()) as { anchor_id?: string; anchorId?: string };
    const anchor = data.anchor_id || data.anchorId || '';
    if (!anchor) throw new Error('Keine Anchor-ID von Bridge');
    return anchor;
}

function sendHeartbeat(anchorId: string): void {
    const payload = JSON.stringify({
        type: 'heartbeat',
        device: WORKER_ADDRESS,
        ts: Date.now(),
    });
    fetch(BRIDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchor: anchorId, payload }),
    }).catch((e) => console.warn('Heartbeat send failed:', (e as Error).message));
}

async function getMonitorStatus(): Promise<unknown> {
    if (!API_URL) return null;
    try {
        const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/monitor-status`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function main(): Promise<void> {
    console.log('Heartbeat-Demo (Streams)\n');

    // Bridge starten (wenn Port nicht schon belegt)
    let bridgeOk = false;
    try {
        const check = await fetch(`${BRIDGE_URL}/?anchor=`);
        if (check.ok) bridgeOk = true;
    } catch {}
    if (!bridgeOk) {
        console.log('Starte Streams-Bridge-Mock auf Port', BRIDGE_PORT, '…');
        await startBridge();
        await new Promise((r) => setTimeout(r, 800));
    } else {
        console.log('Bridge läuft bereits auf Port', BRIDGE_PORT);
    }

    const anchorId = await createChannel();
    console.log('Kanal erstellt. Anchor-ID:', anchorId);

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const stateFile = path.join(tmpDir, 'heartbeat-demo-state.json');

    console.log('\n--- Boss: Backend mit folgender Env starten ---');
    console.log(`STREAMS_BRIDGE_URL=${BRIDGE_URL}`);
    console.log(`STREAMS_ANCHOR_ID=${anchorId}`);
    console.log(`MONITOR_DEVICES=${WORKER_ADDRESS}`);
    console.log('ENABLE_MONITOR=true');
    console.log(`MONITOR_STATE_FILE=${stateFile}`);
    console.log('\nDann in der UI: Überwachung → Geräte-Status (nach ~5–10 s sollte das Gerät online sein).\n');

    console.log('--- Arbeiter: Heartbeats werden von diesem Skript gesendet ---');
    console.log('Worker-Adresse:', WORKER_ADDRESS);
    console.log('Beende mit Ctrl+C.\n');

    sendHeartbeat(anchorId);
    const interval = setInterval(() => sendHeartbeat(anchorId), 15000);

    if (API_URL) {
        const statusInterval = setInterval(async () => {
            const status = await getMonitorStatus();
            if (status && typeof status === 'object' && 'data' in status && Array.isArray((status as { data: unknown }).data)) {
                const data = (status as { data: Array<{ device: string; status: string; lastSeen?: number }> }).data;
                const dev = data.find((d) => d.device === WORKER_ADDRESS || d.device?.toLowerCase() === WORKER_ADDRESS.toLowerCase());
                if (dev) console.log('[Monitor]', dev.device.slice(0, 12) + '…', dev.status, dev.lastSeen ? new Date(dev.lastSeen).toLocaleTimeString() : '');
            }
        }, 5000);
        process.once('SIGINT', () => clearInterval(statusInterval));
    }

    process.once('SIGINT', () => {
        clearInterval(interval);
        if (bridgeProcess) bridgeProcess.kill();
        process.exit(0);
    });
}

main().catch((e) => {
    console.error(e);
    if (bridgeProcess) bridgeProcess.kill();
    process.exit(1);
});
