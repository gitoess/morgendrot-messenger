/**
 * Lokale Kontakte: Anzeigename + optionale Meshtastic-Felder (Vault-/Mapping-Hoheit).
 * Abwärtskompatibel: alter JSON-Modus { "0x…": "Name" } wird weiter gelesen.
 */
import fs from 'fs';
import path from 'path';

const DEFAULT_FILE = '.morgendrot-contact-labels.json';

export type ContactMeshEntry = {
    label: string;
    /** Meshtastic Node ID, z. B. !a1b2c3d4 */
    meshNodeId?: string;
    /** X25519 Public Key, 64 Hex-Zeichen (32 Bytes) */
    meshPublicKeyHex?: string;
    /** BLE-Geräte-UUID (BitChat-/Ad-hoc-Reserve), normalisiert klein + Bindestriche */
    bleUuid?: string;
};

/** Adresse (lowercase 0x+64hex) → Eintrag */
export type ContactDirectory = Record<string, ContactMeshEntry>;

function filePath(): string {
    return path.resolve(process.cwd(), process.env.CONTACT_LABELS_FILE || DEFAULT_FILE);
}

function normalizeAddress(addr: string): string | null {
    const hex = (addr || '').trim().toLowerCase();
    return /^0x[a-f0-9]{64}$/.test(hex) ? hex : null;
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
    if (!label && !meshNodeId && !meshPublicKeyHex && !bleUuid) return null;
    return {
        label: label || 'Partner',
        ...(meshNodeId && { meshNodeId }),
        ...(meshPublicKeyHex && { meshPublicKeyHex }),
        ...(bleUuid && { bleUuid }),
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
            const addr = normalizeAddress(k);
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
    const hex = normalizeAddress(address);
    if (!hex) return;
    const dir = loadContactDirectory();
    const prev = dir[hex] ?? { label: 'Partner' };
    dir[hex] = { ...prev, label: (label || 'Partner').trim().slice(0, 64) || 'Partner' };
    writeDirectory(dir);
}

export function saveContactMeshFields(
    address: string,
    fields: { label?: string; meshNodeId?: string | null; meshPublicKeyHex?: string | null; bleUuid?: string | null }
): void {
    const hex = normalizeAddress(address);
    if (!hex) return;
    const dir = loadContactDirectory();
    const prev = dir[hex] ?? { label: 'Partner' };
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
    dir[hex] = next;
    writeDirectory(dir);
}

export function mergeContactDirectory(incoming: ContactDirectory): { merged: number } {
    const dir = loadContactDirectory();
    let merged = 0;
    for (const [k, v] of Object.entries(incoming)) {
        const addr = normalizeAddress(k);
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

export function getContactLabel(address: string): string | undefined {
    const hex = normalizeAddress(address);
    if (!hex) return undefined;
    return loadContactDirectory()[hex]?.label;
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
