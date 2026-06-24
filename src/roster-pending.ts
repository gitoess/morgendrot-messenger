/**
 * Boss-Roster Pending Queue (`.morgendrot-roster-pending.json`) — SSOT auf dem Boss-Server.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
    ROSTER_PENDING_MAX_ENTRIES,
    ROSTER_PENDING_VERSION,
    type RosterPendingEntry,
    type RosterPendingKind,
    type RosterPendingStatus,
    type RosterPendingStoreFile,
} from './shared/roster-pending.js';

const DEFAULT_FILE = '.morgendrot-roster-pending.json';

function filePath(): string {
    return path.resolve(process.cwd(), process.env.ROSTER_PENDING_FILE || DEFAULT_FILE);
}

function newId(): string {
    return `rp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function loadStore(): RosterPendingStoreFile {
    try {
        const p = filePath();
        if (!fs.existsSync(p)) return { version: ROSTER_PENDING_VERSION, entries: [] };
        const j = JSON.parse(fs.readFileSync(p, 'utf8')) as RosterPendingStoreFile;
        if (j?.version !== ROSTER_PENDING_VERSION || !Array.isArray(j.entries)) {
            return { version: ROSTER_PENDING_VERSION, entries: [] };
        }
        return j;
    } catch {
        return { version: ROSTER_PENDING_VERSION, entries: [] };
    }
}

function writeStore(store: RosterPendingStoreFile): void {
    const p = filePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(store, null, 0), 'utf8');
}

function entryKey(e: RosterPendingEntry): string {
    if (e.kind === 'join_request' && e.requestId) return `join:${e.requestId}`;
    return `addr:${e.member.address.toLowerCase()}`;
}

export function listRosterPendingEntries(opts?: {
    status?: RosterPendingStatus;
    kind?: RosterPendingKind;
}): RosterPendingEntry[] {
    let entries = loadStore().entries;
    if (opts?.status) entries = entries.filter((e) => e.status === opts.status);
    if (opts?.kind) entries = entries.filter((e) => e.kind === opts.kind);
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertRosterPendingEntry(
    input: Omit<RosterPendingEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string }
): RosterPendingEntry {
    const store = loadStore();
    const now = Date.now();
    const key = input.kind === 'join_request' && input.requestId
        ? `join:${input.requestId}`
        : `addr:${input.member.address.toLowerCase()}`;
    const idx = store.entries.findIndex((e) => entryKey(e) === key);
    const prev = idx >= 0 ? store.entries[idx] : undefined;
    if (prev && (prev.status === 'approved' || prev.status === 'rejected')) {
        return prev;
    }
    const entry: RosterPendingEntry = {
        id: input.id?.trim() || prev?.id || newId(),
        kind: input.kind,
        status: prev?.status === 'dismissed' ? 'pending' : prev?.status ?? 'pending',
        member: input.member,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        ...(input.handoffLabel ? { handoffLabel: input.handoffLabel } : {}),
        ...(input.registryEntryId ? { registryEntryId: input.registryEntryId } : {}),
        ...(input.requestId ? { requestId: input.requestId } : {}),
        ...(input.boss ? { boss: input.boss } : {}),
        ...(input.teamId ? { teamId: input.teamId } : {}),
        ...(input.note ? { note: input.note } : {}),
        ...(input.issuedAt != null ? { issuedAt: input.issuedAt } : {}),
    };
    if (idx >= 0) store.entries[idx] = entry;
    else store.entries.unshift(entry);
    store.entries = store.entries
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, ROSTER_PENDING_MAX_ENTRIES);
    writeStore(store);
    return entry;
}

export function setRosterPendingStatus(id: string, status: RosterPendingStatus): RosterPendingEntry | null {
    const store = loadStore();
    const idx = store.entries.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    store.entries[idx] = { ...store.entries[idx], status, updatedAt: Date.now() };
    writeStore(store);
    return store.entries[idx];
}

export function removeRosterPendingEntry(id: string): boolean {
    const store = loadStore();
    const next = store.entries.filter((e) => e.id !== id);
    if (next.length === store.entries.length) return false;
    writeStore({ version: ROSTER_PENDING_VERSION, entries: next });
    return true;
}
