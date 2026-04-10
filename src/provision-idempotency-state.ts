/**
 * Idempotenz für POST /api/provision-device (Doppelklick, Retry).
 * Zustand: .morgendrot-provision-idempotency.json (enthält vollständige Erfolgs-JSON — sensibel, nicht committen).
 * Siehe docs/API-PROVISION-DEVICE-IDEMPOTENCY-SKIZZE.md
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STATE_FILE = path.join(process.cwd(), '.morgendrot-provision-idempotency.json');
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Entry = {
    fingerprint: string;
    response: Record<string, unknown>;
    completedAt: string;
};

type StateFile = { version: 1; entries: Record<string, Entry> };

/** Serialisiert alle provision-device-Läufe mit Idempotency-Key (Boss-UI: meist ein Nutzer). */
let mutex = Promise.resolve();

export function withProvisionDeviceIdempotencyLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = mutex.then(() => fn());
    mutex = run.then(
        () => {},
        () => {}
    );
    return run;
}

function prune(s: StateFile): void {
    const now = Date.now();
    for (const k of Object.keys(s.entries)) {
        const t = new Date(s.entries[k].completedAt).getTime();
        if (!Number.isFinite(t) || now - t > TTL_MS) delete s.entries[k];
    }
}

function loadState(): StateFile {
    try {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const p = JSON.parse(raw) as StateFile;
        if (p.version !== 1 || !p.entries || typeof p.entries !== 'object') throw new Error('invalid');
        prune(p);
        return p;
    } catch {
        return { version: 1, entries: {} };
    }
}

function saveState(s: StateFile): void {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

function hashIdempotencyKeyLookup(key: string): string {
    return crypto.createHash('sha256').update(String(key || ''), 'utf8').digest('hex');
}

export function resolveProvisionIdempotencyKey(
    headerRaw: string | string[] | undefined,
    body: Record<string, unknown>
): { key: string | null; error?: string } {
    const h = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    const headerKey = typeof h === 'string' ? h.trim() : '';
    const bodyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (headerKey && bodyKey && headerKey !== bodyKey) {
        return { key: null, error: 'idempotencyKey (Body) und Idempotency-Key (Header) widersprechen sich.' };
    }
    const key = headerKey || bodyKey;
    if (!key) return { key: null };
    if (key.length < 8 || key.length > 128) {
        return { key: null, error: 'Idempotency-Key: Länge 8–128 Zeichen.' };
    }
    if (!/^[A-Za-z0-9._-]+$/.test(key)) {
        return { key: null, error: 'Idempotency-Key: nur A–Z a–z 0–9 . _ -' };
    }
    return { key };
}

function stableStringify(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map((x) => stableStringify(x)).join(',') + ']';
    const o = obj as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

/** SHA-256 über kanonisches JSON des Bodies ohne `idempotencyKey` (Top-Level). */
export function provisionRequestFingerprint(body: Record<string, unknown>): string {
    const clone = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
    delete clone.idempotencyKey;
    return crypto.createHash('sha256').update(stableStringify(clone), 'utf8').digest('hex');
}

export function tryProvisionIdempotentReplayOrConflict(
    idempotencyKey: string,
    fingerprint: string
): { kind: 'proceed' } | { kind: 'replay'; response: Record<string, unknown> } | { kind: 'conflict' } {
    const s = loadState();
    const h = hashIdempotencyKeyLookup(idempotencyKey);
    const ent = s.entries[h];
    if (!ent) return { kind: 'proceed' };
    if (ent.fingerprint === fingerprint) return { kind: 'replay', response: { ...ent.response } };
    return { kind: 'conflict' };
}

export function saveProvisionIdempotencySuccess(
    idempotencyKey: string,
    fingerprint: string,
    response: Record<string, unknown>
): void {
    const s = loadState();
    const h = hashIdempotencyKeyLookup(idempotencyKey);
    const ent = s.entries[h];
    if (ent?.fingerprint === fingerprint) return;
    if (ent && ent.fingerprint !== fingerprint) {
        throw new Error('provision idempotency: Speichern bei Key-Konflikt');
    }
    s.entries[h] = {
        fingerprint,
        response: JSON.parse(JSON.stringify(response)) as Record<string, unknown>,
        completedAt: new Date().toISOString(),
    };
    saveState(s);
}
