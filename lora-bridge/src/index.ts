/**
 * LoRa-Bridge – HTTP-Server für Morgendrot STREAMS_BRIDGE_URL.
 * Verbindet Morgendrot mit LoRa-Mesh (Heltec/Meshtastic).
 * Simulation: Keine Hardware nötig.
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { CFG } from './config.js';
import { type ILoraDriver, SimLoraDriver } from './lora-driver.js';
import { tryParseEmergencyWire, validateEmergencyEnvelope } from './emergency-envelope.js';
import { buildEmergencyBinaryV2, latin1ToBinaryWire, tryParseEmergencyBinaryV2 } from './emergency-binary.js';

interface StreamsMessage {
    sender?: string;
    payload: string;
    nonce?: number;
    ts?: number;
}

const messages: StreamsMessage[] = [];
const seenKeys = new Set<string>();
const MAX_MESSAGES = 500;
const MAX_PAYLOAD_BYTES = CFG.MAX_PAYLOAD_BYTES;

let lora: ILoraDriver = new SimLoraDriver();

async function createLoraDriver(): Promise<ILoraDriver> {
    if (CFG.SIMULATION_MODE || !CFG.LORA_SERIAL_PORT.trim()) {
        return new SimLoraDriver();
    }
    try {
        const { SerialLoraDriver } = await import('./serial-lora-driver.js');
        const d = new SerialLoraDriver(CFG.LORA_SERIAL_PORT.trim(), CFG.LORA_BAUD_RATE);
        await d.open();
        log(`Serial offen: ${CFG.LORA_SERIAL_PORT} @ ${CFG.LORA_BAUD_RATE}`);
        return d;
    } catch (e) {
        log(`Serial nicht verfügbar (${(e as Error).message}) → Simulation`);
        return new SimLoraDriver();
    }
}

function log(msg: string): void {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${msg}`);
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
            } catch {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

function checkAuth(req: IncomingMessage): boolean {
    if (!CFG.API_KEY) return true;
    const auth = req.headers['authorization'] || req.headers['x-api-key'];
    if (typeof auth === 'string') {
        const key = auth.replace(/^Bearer\s+/i, '').trim();
        return key === CFG.API_KEY;
    }
    return false;
}

function corsHeaders(origin: string | undefined): Record<string, string> {
    const allow = CFG.CORS_ORIGINS.length === 0 || (origin && CFG.CORS_ORIGINS.includes(origin));
    return {
        'Access-Control-Allow-Origin': allow && origin ? origin : '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
    };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const origin = req.headers.origin;
    const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };

    if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return;
    }

    if (!checkAuth(req)) {
        res.writeHead(401, headers);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
    }

    if (req.method === 'GET') {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const anchor = url.searchParams.get('anchor') || '';
        const list = messages.filter((m) => !anchor || m.payload.includes(anchor));
        res.writeHead(200, headers);
        res.end(JSON.stringify({ messages: list }));
        return;
    }

    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const anchor = String(body.anchor || '').trim();
            const emergencyV2 = body.emergencyV2;
            if (emergencyV2 !== undefined && typeof emergencyV2 === 'object' && emergencyV2 !== null) {
                const o = emergencyV2 as Record<string, unknown>;
                const senderAddress = String(o.senderAddress ?? '').trim();
                const nonce = Number(o.nonce);
                const ctB64 = String(o.ciphertext ?? '');
                let ct: Uint8Array;
                try {
                    ct = Uint8Array.from(Buffer.from(ctB64, 'base64'));
                } catch {
                    res.writeHead(400, headers);
                    res.end(JSON.stringify({ error: 'ciphertext base64 ungültig' }));
                    return;
                }
                const built = buildEmergencyBinaryV2(senderAddress, nonce, ct, MAX_PAYLOAD_BYTES);
                if (!built.ok) {
                    res.writeHead(400, headers);
                    res.end(JSON.stringify({ error: built.error }));
                    return;
                }
                await lora.send(built.wire);
                log(`Published emergency v2: nonce=${nonce} bytes=${built.wire.length}`);
                res.writeHead(200, headers);
                res.end(JSON.stringify({ ok: true, emergencyV2: true }));
                return;
            }

            const emergencyRaw = body.emergency;

            if (emergencyRaw !== undefined) {
                const ev = validateEmergencyEnvelope(emergencyRaw, MAX_PAYLOAD_BYTES);
                if (!ev.ok) {
                    res.writeHead(400, headers);
                    res.end(JSON.stringify({ error: ev.error }));
                    return;
                }
                await lora.send(ev.wire);
                log(`Published emergency v1 (${ev.envelope.t}): f=${ev.envelope.f} n=${ev.envelope.n}`);
                res.writeHead(200, headers);
                res.end(JSON.stringify({ ok: true, emergency: true }));
                return;
            }

            const payload = String(body.payload || '').trim();

            if (!payload) {
                res.writeHead(400, headers);
                res.end(JSON.stringify({ error: 'payload, emergency oder emergencyV2 erforderlich' }));
                return;
            }

            const payloadBytes = new TextEncoder().encode(payload).length;
            if (payloadBytes > MAX_PAYLOAD_BYTES) {
                res.writeHead(400, headers);
                res.end(JSON.stringify({ error: `payload too large (max ${MAX_PAYLOAD_BYTES} bytes)` }));
                return;
            }

            await lora.send(JSON.stringify({ anchor, payload, ts: Date.now() }));
            log(`Published to LoRa: ${payload.slice(0, 50)}…`);
            res.writeHead(200, headers);
            res.end(JSON.stringify({ ok: true }));
        } catch (e) {
            res.writeHead(400, headers);
            res.end(JSON.stringify({ error: (e as Error).message }));
        }
        return;
    }

    res.writeHead(405, headers);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
}

function addMessage(msg: StreamsMessage): void {
    const key = `${msg.sender ?? '?'}:${msg.nonce ?? msg.ts ?? randomUUID()}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    messages.unshift(msg);
    if (messages.length > MAX_MESSAGES) messages.pop();
}

/** Startet den Server. Für Tests: gibt Server-Instanz zurück. */
export async function startServer(): Promise<ReturnType<typeof createServer>> {
    await lora.close().catch(() => {});
    lora = await createLoraDriver();
    log(`LoRa-Bridge startet (Port ${CFG.PORT})`);
    log(`Modus: ${CFG.SIMULATION_MODE ? 'Simulation (keine Hardware)' : 'Serial ' + CFG.LORA_SERIAL_PORT}`);

    lora.onReceive((payload, senderId) => {
        let msg: StreamsMessage;
        const rawBuf = latin1ToBinaryWire(payload);
        const v2 = tryParseEmergencyBinaryV2(rawBuf, MAX_PAYLOAD_BYTES);
        if (v2) {
            msg = {
                sender: `v2:${v2.fingerprintHex.slice(0, 16)}`,
                payload,
                nonce: v2.nonce,
                ts: Date.now(),
            };
        } else {
            const emerg = tryParseEmergencyWire(payload, MAX_PAYLOAD_BYTES);
            if (emerg) {
                msg = {
                    sender: emerg.f,
                    payload,
                    nonce: emerg.n,
                    ts: Date.now(),
                };
            } else {
                try {
                    const parsed = JSON.parse(payload) as Record<string, unknown>;
                    const inner = parsed.payload ?? payload;
                    msg = {
                        sender: (parsed.sender as string) ?? senderId ?? 'lora',
                        payload: typeof inner === 'string' ? inner : JSON.stringify(inner),
                        nonce: (parsed.nonce as number) ?? Date.now(),
                        ts: (parsed.ts as number) ?? Date.now(),
                    };
                } catch {
                    msg = { sender: senderId ?? 'lora', payload, nonce: Date.now(), ts: Date.now() };
                }
            }
        }
        addMessage(msg);
        log(`Received from LoRa: ${msg.payload.slice(0, 40)}…`);

        // Optional: an Morgendrot-Gateway weiterleiten (Tiny → LoRa/Meshtastic → Bridge → POST /api/tiny-message)
        const gatewayUrl = CFG.MORGENDROT_GATEWAY_URL;
        if (gatewayUrl) {
            const forwardBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const url = `${gatewayUrl.replace(/\/$/, '')}/api/tiny-message`;
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: forwardBody })
                .then((r) => { if (!r.ok) log(`Gateway forward: ${r.status}`); })
                .catch((e) => log(`Gateway forward: ${(e as Error).message}`));
        }
    });

    const server = createServer(handleRequest);
    return new Promise((resolve, reject) => {
        server.listen(CFG.PORT, () => {
            log(`Bridge bereit: http://localhost:${CFG.PORT}`);
            log(`Morgendrot: STREAMS_BRIDGE_URL=http://localhost:${CFG.PORT}`);
            resolve(server);
        });
        server.on('error', reject);
    });
}

async function main(): Promise<void> {
    if (process.env.LORA_BRIDGE_TEST) return;
    const server = await startServer();
    process.on('SIGINT', async () => {
        log('Beende...');
        await lora.close();
        server.close();
        process.exit(0);
    });
}

main().catch((e) => {
    if (!process.env.LORA_BRIDGE_TEST) {
        console.error('Start fehlgeschlagen:', e);
        process.exit(1);
    }
});
