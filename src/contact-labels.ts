/**
 * Lokale Kontakte: Anzeigename + optionale Meshtastic-Felder (Vault-/Mapping-Hoheit).
 * Abwärtskompatibel: alter JSON-Modus { "0x…": "Name" } wird weiter gelesen.
 */
import fs from 'fs';
import path from 'path';
import type { InitialProfile, InitialProfileContact } from './initial-profile-provision.js';

const DEFAULT_FILE = '.morgendrot-contact-labels.json';

export type ContactMeshEntry = {
    label: string;
    /** Anzeige-Tags (Einsatz, z. B. Medic) — kein Chain-ROLE */
    roleTags?: string[];
    /** Meshtastic Node ID, z. B. !a1b2c3d4 */
    meshNodeId?: string;
    /** X25519 Public Key, 64 Hex-Zeichen (32 Bytes) */
    meshPublicKeyHex?: string;
    /** BLE-Geräte-UUID (BitChat-/Ad-hoc-Reserve), normalisiert klein + Bindestriche */
    bleUuid?: string;
    /**
     * Optionale IOTA-Object-ID einer privaten/alternativen Mailbox des Kontakts (0x + 64 Hex).
     * Legacy-Alias für `mailboxPrivateId` (M4e).
     */
    mailboxObjectId?: string;
    /** M4e: Ziel-Mailboxen des Kontakts (je 0x + 64 Hex). */
    mailboxSharedId?: string;
    mailboxPrivateId?: string;
    mailboxTeamId?: string;
    mailboxBufferId?: string;
    /** Telegram Chat-ID für optionalen Kurz-Hinweis nach Forensik-Send (§ H.26 Phase B). */
    telegramChatId?: string;
};

/**
 * Verzeichnis-Schlüssel: IOTA-Wallet (0x+64hex) oder rein Telegram `tg:<chatId>`.
 * Messenger/Chain nutzen weiterhin 0x; tg:-Keys sind für Kurz-Hinweise ohne bekannte Wallet.
 */
export type ContactDirectory = Record<string, ContactMeshEntry>;

const TG_DIRECTORY_KEY = /^tg:-?\d{1,20}$/;

function filePath(): string {
    return path.resolve(process.cwd(), process.env.CONTACT_LABELS_FILE || DEFAULT_FILE);
}

function normalizeAddress(addr: string): string | null {
    const hex = (addr || '').trim().toLowerCase();
    return /^0x[a-f0-9]{64}$/.test(hex) ? hex : null;
}

export function normalizeTelegramChatId(raw: string): string | null {
    const t = (raw || '').trim();
    return /^-?\d{1,20}$/.test(t) ? t : null;
}

/** Gültiger Schlüssel in `.morgendrot-contact-labels.json`. */
export function normalizeDirectoryKey(addr: string): string | null {
    const hex = normalizeAddress(addr);
    if (hex) return hex;
    const lower = (addr || '').trim().toLowerCase();
    return TG_DIRECTORY_KEY.test(lower) ? lower : null;
}

/** Speicher-Schlüssel aus Adressfeld und/oder Telegram Chat-ID. */
export function resolveContactStorageKey(addressRaw: string, telegramChatIdRaw?: string): string | null {
    const fromAddr = normalizeDirectoryKey(addressRaw);
    if (fromAddr) return fromAddr;
    const tg = normalizeTelegramChatId(telegramChatIdRaw ?? '');
    return tg ? `tg:${tg}` : null;
}

/** IOTA-Object-ID (private Mailbox, Package, …): 0x + 64 Hex. */
export function normalizeMailboxObjectId(id: string): string | null {
    return normalizeAddress(id);
}

/** Normalisiert !deadbeef (Kleinbuchstaben hex). */
export function normalizeMeshNodeId(id: string): string | null {
    const s = (id || '').trim();
    if (!s.startsWith('!')) return null;
    const hex = s.slice(1).toLowerCase();
    if (!/^[0-9a-f]{1,64}$/.test(hex)) return null;
    return `!${hex}`;
}

export function isValidMeshPublicKeyHex(h: string): boolean {
    const x = (h || '').trim().toLowerCase();
    return /^[0-9a-f]{64}$/.test(x);
}

/** UUID v4-Format (wir validieren nur Hex-Struktur, nicht RFC-Variant-Bits). */
export function normalizeBleUuid(s: string): string | null {
    const t = (s || '').trim().toLowerCase();
    const compact = t.replace(/-/g, '');
    if (!/^[0-9a-f]{32}$/.test(compact)) return null;
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function isValidBleUuid(s: string): boolean {
    return normalizeBleUuid(s) !== null;
}

function parseEntry(raw: unknown): ContactMeshEntry | null {
    if (typeof raw === 'string') {
        const label = raw.trim().slice(0, 64) || 'Partner';
        return { label };
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    const label =
        typeof o.label === 'string'
            ? o.label.trim().slice(0, 64)
            : typeof o.displayName === 'string'
              ? o.displayName.trim().slice(0, 64)
              : '';
    const meshNodeId = typeof o.meshNodeId === 'string' ? normalizeMeshNodeId(o.meshNodeId) ?? undefined : undefined;
    const meshPublicKeyHex =
        typeof o.meshPublicKeyHex === 'string' && isValidMeshPublicKeyHex(o.meshPublicKeyHex)
            ? o.meshPublicKeyHex.trim().toLowerCase()
            : undefined;
    const bleUuid = typeof o.bleUuid === 'string' ? normalizeBleUuid(o.bleUuid) ?? undefined : undefined;
    const mailboxObjectId =
        typeof o.mailboxObjectId === 'string' ? normalizeMailboxObjectId(o.mailboxObjectId) ?? undefined : undefined;
    const mailboxPrivateId =
        typeof o.mailboxPrivateId === 'string'
            ? normalizeMailboxObjectId(o.mailboxPrivateId) ?? undefined
            : mailboxObjectId;
    const mailboxSharedId =
        typeof o.mailboxSharedId === 'string' ? normalizeMailboxObjectId(o.mailboxSharedId) ?? undefined : undefined;
    const mailboxTeamId =
        typeof o.mailboxTeamId === 'string' ? normalizeMailboxObjectId(o.mailboxTeamId) ?? undefined : undefined;
    const mailboxBufferId =
        typeof o.mailboxBufferId === 'string' ? normalizeMailboxObjectId(o.mailboxBufferId) ?? undefined : undefined;
    const telegramChatId =
        typeof o.telegramChatId === 'string' && /^-?\d{1,20}$/.test(o.telegramChatId.trim())
            ? o.telegramChatId.trim()
            : undefined;
    let roleTags: string[] | undefined;
    if (Array.isArray(o.roleTags)) {
        const tags = o.roleTags
            .map((t) => String(t).trim().slice(0, 48))
            .filter(Boolean)
            .slice(0, 20);
        if (tags.length) roleTags = tags;
    }
    if (
        !label &&
        !meshNodeId &&
        !meshPublicKeyHex &&
        !bleUuid &&
        !roleTags?.length &&
        !mailboxObjectId &&
        !mailboxPrivateId &&
        !mailboxSharedId &&
        !mailboxTeamId &&
        !mailboxBufferId &&
        !telegramChatId
    )
        return null;
    const priv = mailboxPrivateId ?? mailboxObjectId;
    return {
        label: label || 'Partner',
        ...(roleTags ? { roleTags } : {}),
        ...(meshNodeId && { meshNodeId }),
        ...(meshPublicKeyHex && { meshPublicKeyHex }),
        ...(bleUuid && { bleUuid }),
        ...(priv && { mailboxObjectId: priv, mailboxPrivateId: priv }),
        ...(mailboxSharedId && { mailboxSharedId }),
        ...(mailboxTeamId && { mailboxTeamId }),
        ...(mailboxBufferId && { mailboxBufferId }),
        ...(telegramChatId && { telegramChatId }),
    };
}

export function loadContactDirectory(): ContactDirectory {
    try {
        const p = filePath();
        if (!fs.existsSync(p)) return {};
        const j = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
        if (typeof j !== 'object' || j === null || Array.isArray(j)) return {};
        const out: ContactDirectory = {};
        for (const [k, v] of Object.entries(j)) {
            const addr = normalizeDirectoryKey(k);
            if (!addr) continue;
            const e = parseEntry(v);
            if (e) out[addr] = e;
        }
        return out;
    } catch {
        return {};
    }
}

function writeDirectory(dir: ContactDirectory): void {
    fs.writeFileSync(filePath(), JSON.stringify(dir, null, 0), 'utf8');
}

/** Nur Anzeigenamen – für bestehende UI (`/api/contact-labels` → labels). */
export function loadContactLabels(): Record<string, string> {
    const dir = loadContactDirectory();
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(dir)) out[k] = v.label;
    return out;
}

export function saveContactLabel(address: string, label: string): void {
    const key = normalizeDirectoryKey(address);
    if (!key) return;
    const dir = loadContactDirectory();
    const prev = dir[key] ?? { label: 'Partner' };
    dir[key] = { ...prev, label: (label || 'Partner').trim().slice(0, 64) || 'Partner' };
    writeDirectory(dir);
}

export function saveContactMeshFields(
    address: string,
    fields: {
        label?: string;
        meshNodeId?: string | null;
        meshPublicKeyHex?: string | null;
        bleUuid?: string | null;
        mailboxObjectId?: string | null;
        mailboxSharedId?: string | null;
        mailboxPrivateId?: string | null;
        mailboxTeamId?: string | null;
        mailboxBufferId?: string | null;
        telegramChatId?: string | null;
    }
): void {
    const key = normalizeDirectoryKey(address);
    if (!key) return;
    const dir = loadContactDirectory();
    const prev = dir[key] ?? { label: 'Partner' };
    const next: ContactMeshEntry = { ...prev };
    if (fields.label !== undefined) next.label = fields.label.trim().slice(0, 64) || 'Partner';
    if (fields.meshNodeId !== undefined) {
        if (fields.meshNodeId === null || fields.meshNodeId === '') delete next.meshNodeId;
        else {
            const n = normalizeMeshNodeId(fields.meshNodeId);
            if (n) next.meshNodeId = n;
        }
    }
    if (fields.meshPublicKeyHex !== undefined) {
        if (fields.meshPublicKeyHex === null || fields.meshPublicKeyHex === '') delete next.meshPublicKeyHex;
        else if (isValidMeshPublicKeyHex(fields.meshPublicKeyHex)) {
            next.meshPublicKeyHex = fields.meshPublicKeyHex.trim().toLowerCase();
        }
    }
    if (fields.bleUuid !== undefined) {
        if (fields.bleUuid === null || fields.bleUuid === '') delete next.bleUuid;
        else {
            const u = normalizeBleUuid(fields.bleUuid);
            if (u) next.bleUuid = u;
        }
    }
    const applyMbSlot = (
        key: 'mailboxSharedId' | 'mailboxPrivateId' | 'mailboxTeamId' | 'mailboxBufferId',
        raw: string | null | undefined
    ) => {
        if (raw === undefined) return;
        if (raw === null || raw === '') {
            delete next[key];
            if (key === 'mailboxPrivateId') delete next.mailboxObjectId;
            return;
        }
        const m = normalizeMailboxObjectId(raw);
        if (!m) return;
        next[key] = m;
        if (key === 'mailboxPrivateId') next.mailboxObjectId = m;
    };
    if (fields.mailboxObjectId !== undefined) {
        if (fields.mailboxObjectId === null || fields.mailboxObjectId === '') {
            delete next.mailboxObjectId;
            delete next.mailboxPrivateId;
        } else {
            const m = normalizeMailboxObjectId(fields.mailboxObjectId);
            if (m) {
                next.mailboxObjectId = m;
                next.mailboxPrivateId = m;
            }
        }
    }
    applyMbSlot('mailboxSharedId', fields.mailboxSharedId);
    applyMbSlot('mailboxPrivateId', fields.mailboxPrivateId);
    applyMbSlot('mailboxTeamId', fields.mailboxTeamId);
    applyMbSlot('mailboxBufferId', fields.mailboxBufferId);
    if (fields.telegramChatId !== undefined) {
        if (fields.telegramChatId === null || fields.telegramChatId === '') delete next.telegramChatId;
        else {
            const t = fields.telegramChatId.trim();
            if (/^-?\d{1,20}$/.test(t)) next.telegramChatId = t;
        }
    }
    if (key.startsWith('tg:') && !next.telegramChatId) {
        next.telegramChatId = key.slice(3);
    }
    dir[key] = next;
    writeDirectory(dir);
}

/** Optionale private/alternative Mailbox des Kontakts (M4 Send-Routing). */
export function getContactMailboxObjectId(address: string): string | undefined {
    const hex = normalizeAddress(address);
    if (!hex) return undefined;
    const e = loadContactDirectory()[hex];
    return e?.mailboxPrivateId ?? e?.mailboxObjectId;
}

export function mergeContactDirectory(incoming: ContactDirectory): { merged: number } {
    const dir = loadContactDirectory();
    let merged = 0;
    for (const [k, v] of Object.entries(incoming)) {
        const addr = normalizeDirectoryKey(k);
        if (!addr || !v || typeof v !== 'object') continue;
        const parsed = parseEntry(v);
        if (!parsed) continue;
        const prev = dir[addr];
        dir[addr] = prev ? { ...prev, ...parsed, label: parsed.label || prev.label } : parsed;
        merged++;
    }
    writeDirectory(dir);
    return { merged };
}

export function getContactTelegramChatId(address: string): string | undefined {
    const key = normalizeDirectoryKey(address);
    if (!key) return undefined;
    if (key.startsWith('tg:')) return key.slice(3);
    return loadContactDirectory()[key]?.telegramChatId;
}

export function getContactLabel(address: string): string | undefined {
    const key = normalizeDirectoryKey(address);
    if (!key) return undefined;
    return loadContactDirectory()[key]?.label;
}

/** Lookup für eingehende Funk-Nachrichten: Node-ID → Kontakt. */
export function getContactByMeshNodeId(nodeId: string): { address: string; entry: ContactMeshEntry } | undefined {
    const norm = normalizeMeshNodeId(nodeId);
    if (!norm) return undefined;
    const dir = loadContactDirectory();
    for (const [addr, e] of Object.entries(dir)) {
        if (e.meshNodeId && normalizeMeshNodeId(e.meshNodeId) === norm) {
            return { address: addr, entry: e };
        }
    }
    return undefined;
}

/** Lookup für BLE-Ad-hoc (Gimmick-Reserve): normalisierte UUID → Kontakt. */
export function getContactByBleUuid(uuid: string): { address: string; entry: ContactMeshEntry } | undefined {
    const norm = normalizeBleUuid(uuid);
    if (!norm) return undefined;
    const dir = loadContactDirectory();
    for (const [addr, e] of Object.entries(dir)) {
        if (e.bleUuid && normalizeBleUuid(e.bleUuid) === norm) {
            return { address: addr, entry: e };
        }
    }
    return undefined;
}

/** Wendet optionale Mesh-/Telegram-/Mailbox-Felder auf einen Verzeichniseintrag an (ohne Schreiben). */
export function mergeInitialProfileContactIntoEntry(prev: ContactMeshEntry, c: InitialProfileContact): ContactMeshEntry {
    const next: ContactMeshEntry = { ...prev };
    const label = (c.name || '').trim().slice(0, 64);
    if (label) next.label = label;

    if (c.roleTags && c.roleTags.length) {
        const tags = c.roleTags.map((t) => String(t).trim().slice(0, 48)).filter(Boolean).slice(0, 20);
        if (tags.length) next.roleTags = tags;
    }

    if (c.meshNodeId !== undefined) {
        const n = normalizeMeshNodeId(c.meshNodeId);
        if (n) next.meshNodeId = n;
    }
    if (c.telegramChatId !== undefined) {
        const t = normalizeTelegramChatId(c.telegramChatId);
        if (t) next.telegramChatId = t;
    }
    const applyMb = (key: 'mailboxSharedId' | 'mailboxPrivateId' | 'mailboxTeamId' | 'mailboxBufferId', raw?: string) => {
        if (raw === undefined) return;
        const m = normalizeMailboxObjectId(raw);
        if (!m) return;
        next[key] = m;
        if (key === 'mailboxPrivateId') next.mailboxObjectId = m;
    };
    if (c.mailboxObjectId !== undefined) {
        const m = normalizeMailboxObjectId(c.mailboxObjectId);
        if (m) {
            next.mailboxObjectId = m;
            next.mailboxPrivateId = m;
        }
    }
    applyMb('mailboxSharedId', c.mailboxSharedId);
    applyMb('mailboxPrivateId', c.mailboxPrivateId);
    applyMb('mailboxTeamId', c.mailboxTeamId);
    applyMb('mailboxBufferId', c.mailboxBufferId);
    return next;
}

/** Wendet ein validiertes `initialProfile` auf die lokale Kontaktdatei an (Merge pro Adresse). */
export function applyInitialProfileToContacts(profile: InitialProfile): { applied: number } {
    const dir = loadContactDirectory();
    let applied = 0;
    for (const c of profile.contacts) {
        const hex = normalizeAddress(c.address);
        if (!hex) continue;
        const prev = dir[hex] ?? { label: 'Partner' };
        dir[hex] = mergeInitialProfileContactIntoEntry(prev, c);
        applied++;
    }
    writeDirectory(dir);
    return { applied };
}
