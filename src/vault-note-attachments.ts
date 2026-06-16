/**
 * Anhänge für Tresor-Notizen — gleiche Dateitypen wie Messenger-Anhänge
 * (Bilder, .txt, Opus/Ogg), mit Vault-spezifischen Größenlimits.
 */
import crypto from 'crypto';

export type VaultNoteAttachmentKind = 'image' | 'text' | 'audio';

export type VaultNoteAttachment = {
    id: string;
    name: string;
    mime: string;
    kind: VaultNoteAttachmentKind;
    /** Standard-Base64 (kein data:-URL-Prefix). */
    dataBase64: string;
    /** Nur bei kind=text — Klartext für Vorschau. */
    textContent?: string;
    updatedAt?: number;
};

export const VN_MAX_ATTACHMENTS = 8;
export const VN_MAX_ATTACHMENT_NAME = 200;
/** Wie Messenger-Rohbild-Pick (12 MB). */
export const VN_MAX_ATTACH_BYTES_IMAGE = 12 * 1024 * 1024;
/** Vault: längere Sprachnotizen als IOTA-Wire erlaubt. */
export const VN_MAX_ATTACH_BYTES_AUDIO = 512 * 1024;
export const VN_MAX_ATTACH_BYTES_TXT = 512 * 1024;

const VN_ATTACH_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function base64DecodedByteLength(b64: string): number {
    const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.floor((b64.length * 3) / 4) - pad;
}

function inferKind(name: string, mime: string): VaultNoteAttachmentKind | null {
    const m = mime.toLowerCase();
    const n = name.toLowerCase();
    if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(n)) return 'image';
    if (m === 'text/plain' || /\.txt$/i.test(n)) return 'text';
    if (
        m === 'audio/ogg' ||
        m === 'audio/opus' ||
        m === 'application/ogg' ||
        m === 'video/ogg' ||
        /\.(opus|ogg)$/i.test(n)
    ) {
        return 'audio';
    }
    return null;
}

function maxBytesForKind(kind: VaultNoteAttachmentKind): number {
    if (kind === 'image') return VN_MAX_ATTACH_BYTES_IMAGE;
    if (kind === 'audio') return VN_MAX_ATTACH_BYTES_AUDIO;
    return VN_MAX_ATTACH_BYTES_TXT;
}

function sanitizeOneAttachment(raw: unknown): VaultNoteAttachment | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    const rawId = typeof o.id === 'string' ? o.id.trim() : '';
    const id = VN_ATTACH_ID_RE.test(rawId) ? rawId : crypto.randomUUID();
    const name = String(o.name ?? 'Anhang').trim().slice(0, VN_MAX_ATTACHMENT_NAME) || 'Anhang';
    const mime = String(o.mime ?? 'application/octet-stream').trim().slice(0, 120);
    const kind = inferKind(name, mime);
    if (!kind) return null;
    const dataBase64 = String(o.dataBase64 ?? '').replace(/\s/g, '');
    if (!dataBase64 || !B64_RE.test(dataBase64)) return null;
    const byteLen = base64DecodedByteLength(dataBase64);
    if (byteLen <= 0 || byteLen > maxBytesForKind(kind)) return null;
    if (kind === 'audio') {
        try {
            const buf = Buffer.from(dataBase64, 'base64');
            const magic = buf.subarray(0, 4).toString('ascii');
            if (magic !== 'OggS') return null;
        } catch {
            return null;
        }
    }
    let textContent: string | undefined;
    if (kind === 'text') {
        const fromField = typeof o.textContent === 'string' ? o.textContent : '';
        if (fromField) {
            textContent = fromField.slice(0, VN_MAX_ATTACH_BYTES_TXT);
        } else {
            try {
                textContent = Buffer.from(dataBase64, 'base64').toString('utf8').slice(0, VN_MAX_ATTACH_BYTES_TXT);
            } catch {
                return null;
            }
        }
    }
    const updatedAt =
        typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? Math.floor(o.updatedAt) : Date.now();
    return {
        id,
        name,
        mime: mime || (kind === 'text' ? 'text/plain' : kind === 'audio' ? 'audio/ogg' : 'image/png'),
        kind,
        dataBase64,
        ...(textContent !== undefined ? { textContent } : {}),
        updatedAt,
    };
}

/** Normalisiert Anhänge einer Notiz (UI/API → Vault-JSON). */
export function sanitizeVaultNoteAttachments(raw: unknown): VaultNoteAttachment[] {
    if (!Array.isArray(raw)) return [];
    const out: VaultNoteAttachment[] = [];
    for (const item of raw.slice(0, VN_MAX_ATTACHMENTS)) {
        const att = sanitizeOneAttachment(item);
        if (att) out.push(att);
    }
    return out;
}
