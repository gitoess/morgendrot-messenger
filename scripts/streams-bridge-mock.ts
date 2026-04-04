/**
 * Minimale Streams-Bridge für Morgendrot-Demos und E2E.
 * Implementiert die von wallet-bridge erwartete API:
 * - POST /streams/create  → { anchor_id }
 * - POST /streams/subscribe → 200
 * - GET ?anchor=X         → { messages: [{ sender?, payload, ts? }] }
 * - GET ?anchor=X&purge=1 → Kanal leeren (Nachrichten löschen), Antwort { ok, message, messages: [] }
 * - POST (root)           → body { anchor, payload } (publish)
 *
 * Start: npx tsx scripts/streams-bridge-mock.ts [PORT]
 * Default-Port: 9343 (STREAMS_BRIDGE_URL=http://127.0.0.1:9343)
 *
 * Optional: STREAMS_MOCK_PERSIST=1 speichert Kanäle in .streams-mock-data.json,
 * damit Nachrichten einen Neustart des Mocks überleben.
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = parseInt(process.env.PORT || process.argv[2] || '9343', 10);
const PERSIST = process.env.STREAMS_MOCK_PERSIST === '1' || process.env.STREAMS_MOCK_PERSIST === 'true';
const PERSIST_FILE = resolve(process.cwd(), '.streams-mock-data.json');

/** Gleiche Kanal-ID nur einmal listen (Groß/Klein). */
function dedupeAnchors(ids: string[]): string[] {
    const m = new Map<string, string>();
    for (const id of ids) {
        const t = (id || '').trim();
        if (!t) continue;
        const k = t.toLowerCase();
        if (!m.has(k)) m.set(k, t);
    }
    return [...m.values()];
}

interface StoredMessage {
    sender?: string;
    payload: string;
    nonce?: number;
    ts?: number;
}

function loadChannels(): Map<string, StoredMessage[]> {
    const map = new Map<string, StoredMessage[]>();
    if (PERSIST && existsSync(PERSIST_FILE)) {
        try {
            const raw = readFileSync(PERSIST_FILE, 'utf-8');
            const obj = JSON.parse(raw) as Record<string, StoredMessage[]>;
            for (const [k, v] of Object.entries(obj)) if (Array.isArray(v)) map.set(k, v);
        } catch {
            // ignore
        }
    }
    return map;
}

function saveChannels(): void {
    if (!PERSIST) return;
    try {
        const obj: Record<string, StoredMessage[]> = {};
        channels.forEach((v, k) => { obj[k] = v; });
        writeFileSync(PERSIST_FILE, JSON.stringify(obj, null, 0), 'utf-8');
    } catch {
        // ignore
    }
}

const channels = loadChannels();

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

function send(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname.replace(/\/$/, '') || '/';

    if (req.method === 'GET') {
        const anchor = url.searchParams.get('anchor') || '';
        const wantList = url.searchParams.get('list') === '1' || url.searchParams.get('list') === 'true';
        const doPurge = url.searchParams.get('purge') === '1' || url.searchParams.get('purge') === 'true';
        if (wantList) {
            send(res, 200, { anchors: dedupeAnchors(Array.from(channels.keys())) });
            return;
        }
        if (doPurge) {
            if (anchor) {
                channels.set(anchor, []);
            } else {
                channels.clear();
            }
            saveChannels();
            send(res, 200, { ok: true, message: anchor ? `Kanal ${anchor.slice(0, 12)}… geleert.` : 'Alle Kanäle geleert.', messages: [] });
            return;
        }
        const list = anchor ? (channels.get(anchor) ?? []) : [];
        saveChannels();
        send(res, 200, { messages: list });
        return;
    }

    if (req.method !== 'POST') {
        send(res, 405, { error: 'Method not allowed' });
        return;
    }

    let body: Record<string, unknown>;
    try {
        body = await parseBody(req);
    } catch {
        send(res, 400, { error: 'Invalid JSON body' });
        return;
    }

    // POST /streams/create  (Morgendrot: Kanal erstellen)
    if (pathname === '/streams/create') {
        const anchorId = randomUUID();
        channels.set(anchorId, []);
        saveChannels();
        send(res, 200, { anchor_id: anchorId, anchorId });
        return;
    }

    // POST /streams/subscribe  (Morgendrot: Kanal abonnieren)
    if (pathname === '/streams/subscribe') {
        const anchorId = String(body.anchor_id ?? body.anchorId ?? '').trim();
        if (!anchorId) {
            send(res, 400, { error: 'anchor_id required' });
            return;
        }
        if (!channels.has(anchorId)) channels.set(anchorId, []);
        saveChannels();
        send(res, 200, { ok: true });
        return;
    }

    // POST (root): publish { anchor, payload }  (HttpStreamsBridgeAdapter.publish)
    if (pathname === '/' || pathname === '') {
        const anchor = String(body.anchor ?? '').trim();
        const payload = String(body.payload ?? '').trim();
        if (!anchor || !payload) {
            send(res, 400, { error: 'anchor and payload required' });
            return;
        }
        if (!channels.has(anchor)) channels.set(anchor, []);
        const list = channels.get(anchor)!;
        list.push({
            sender: (body.sender as string) || undefined,
            payload,
            ts: Date.now(),
        });
        saveChannels();
        send(res, 200, { ok: true });
        return;
    }

    send(res, 404, { error: 'Not found' });
}

const server = createServer(handleRequest);
server.listen(PORT, '127.0.0.1', () => {
    console.log(`Streams-Bridge-Mock: http://127.0.0.1:${PORT}`);
    console.log('  POST /streams/create  → anchor_id');
    console.log('  POST /streams/subscribe → ok');
    console.log('  GET ?anchor=ID        → messages');
    console.log('  POST { anchor, payload } → publish');
    if (PERSIST) console.log('  Persistenz: .streams-mock-data.json (STREAMS_MOCK_PERSIST=1)');
    console.log('Morgendrot: STREAMS_BRIDGE_URL=http://127.0.0.1:' + PORT);
});
