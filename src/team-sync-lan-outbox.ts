/**
 * LAN-Team-Sync Outbox — schnelle Zustellung für Helfer mit Boss-Basis-URL im WLAN.
 * Persistenz bleibt IOTA; dies ist nur Push/Cache (§ TEAM-MEMBER-UPDATE-WIZARD-SPEC §8).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_FILE = '.morgendrot-team-sync-lan-outbox.json';
const MAX_ENTRIES = 500;
const MAX_WIRE_BYTES = 65536;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TeamSyncLanOutboxEntry = {
    id: string;
    wire: string;
    createdAt: number;
    teamMailboxAddress?: string;
    teamId?: string;
    seq?: number;
    /** Leer = an alle Pollenden; sonst nur diese Adressen (lowercase 0x…). */
    recipientAddresses: string[];
};

type StoreFile = {
    version: 1;
    entries: TeamSyncLanOutboxEntry[];
};

function filePath(): string {
    return path.resolve(process.cwd(), process.env.TEAM_SYNC_LAN_OUTBOX_FILE || DEFAULT_FILE);
}

function loadStore(): StoreFile {
    try {
        const p = filePath();
        if (!fs.existsSync(p)) return { version: 1, entries: [] };
        const j = JSON.parse(fs.readFileSync(p, 'utf8')) as StoreFile;
        if (j?.version !== 1 || !Array.isArray(j.entries)) return { version: 1, entries: [] };
        return j;
    } catch {
        return { version: 1, entries: [] };
    }
}

function writeStore(store: StoreFile): void {
    const p = filePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(store, null, 0), 'utf8');
}

function prune(store: StoreFile): StoreFile {
    const cutoff = Date.now() - TTL_MS;
    return {
        version: 1,
        entries: store.entries.filter((e) => e.createdAt >= cutoff).slice(0, MAX_ENTRIES),
    };
}

function normAddr(a: string): string | null {
    const t = (a || '').trim().toLowerCase();
    return /^0x[a-f0-9]{64}$/.test(t) ? t : null;
}

export function pushTeamSyncLanWire(input: {
    wire: string;
    teamMailboxAddress?: string;
    teamId?: string;
    seq?: number;
    recipientAddresses?: string[];
}): TeamSyncLanOutboxEntry {
    const wire = String(input.wire ?? '').trim();
    if (!wire.includes('[[MORG_')) {
        throw new Error('wire muss einen MORG_* Marker enthalten.');
    }
    if (Buffer.byteLength(wire, 'utf8') > MAX_WIRE_BYTES) {
        throw new Error('wire zu groß.');
    }
    const recipients = (input.recipientAddresses ?? [])
        .map((a) => normAddr(a))
        .filter((a): a is string => !!a);
    const store = prune(loadStore());
    const entry: TeamSyncLanOutboxEntry = {
        id: `lan-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        wire,
        createdAt: Date.now(),
        recipientAddresses: recipients,
        ...(input.teamMailboxAddress && normAddr(input.teamMailboxAddress)
            ? { teamMailboxAddress: normAddr(input.teamMailboxAddress)! }
            : {}),
        ...(input.teamId?.trim() ? { teamId: input.teamId.trim().slice(0, 64) } : {}),
        ...(input.seq != null && Number.isFinite(input.seq) ? { seq: input.seq } : {}),
    };
    store.entries.unshift(entry);
    writeStore(prune(store));
    return entry;
}

export function listTeamSyncLanInbox(opts: {
    recipientAddress: string;
    sinceMs?: number;
}): TeamSyncLanOutboxEntry[] {
    const addr = normAddr(opts.recipientAddress);
    if (!addr) return [];
    const since = opts.sinceMs ?? 0;
    const store = prune(loadStore());
    return store.entries.filter((e) => {
        if (e.createdAt < since) return false;
        if (!e.recipientAddresses.length) return true;
        return e.recipientAddresses.includes(addr);
    });
}
