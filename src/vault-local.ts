/**
 * Lokaler Vault: ECDH-Keypair mit Passwort verschlüsselt speichern/laden.
 * Gleicher Key über Neustarts → stabiler Shared Secret mit Partner.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
    deserializeSessionKeysArchive,
    mergeSessionKeysFromHandshakePeers,
    type SessionKeysArchiveFile,
} from './shared/morgendrot-session-keys-archive.js';

const subtle = crypto.webcrypto.subtle;
const CURVE = 'P-256';
/** OWASP 2023: ≥310.000 für PBKDF2-HMAC-SHA256 empfohlen. Optional: Argon2id (NIST/OWASP) als KDF_ALG=argon2. */
const PBKDF2_ITERATIONS = 310_000;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;

export type VaultKeys = {
    privateKey: CryptoKey;
    pubRaw: Uint8Array;
};

/** KeePass-ähnliche Einträge im gleichen AES-GCM-Vault-Payload wie die Messaging-Keys. */
export type PersonalSecretEntry = {
    id: string;
    title: string;
    username?: string;
    /** Passwort, Seed oder anderer Geheimtext */
    secret?: string;
    note?: string;
    updatedAt?: number;
};

const PS_MAX_ENTRIES = 300;
const PS_MAX_TITLE = 256;
const PS_MAX_USER = 256;
const PS_MAX_SECRET = 16_384;
const PS_MAX_NOTE = 50_000;

export type { VaultNoteAttachment, VaultNoteAttachmentKind };
export { sanitizeVaultNoteAttachments };

/** Strukturierte Notizen (Tresor) — mehrere benannte Einträge, optional Ordner. */
export type VaultNoteEntry = {
    id: string;
    title: string;
    /** Leer = ohne Ordner */
    folder?: string;
    body: string;
    attachments?: VaultNoteAttachment[];
    updatedAt?: number;
};

const VN_MAX_ENTRIES = 200;
const VN_MAX_TITLE = 120;
const VN_MAX_FOLDER = 64;
const VN_MAX_BODY = 50_000;
const VN_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;

/** Normalisiert Notizen aus Vault-JSON (Migration aus Legacy-Freitext `notes`). */
export function sanitizeVaultNotes(raw: unknown, legacyNotes?: string): VaultNoteEntry[] {
    const out: VaultNoteEntry[] = [];
    if (Array.isArray(raw)) {
        for (const item of raw.slice(0, VN_MAX_ENTRIES)) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
            const o = item as Record<string, unknown>;
            const rawId = typeof o.id === 'string' ? o.id.trim() : '';
            const id = VN_ID_RE.test(rawId) ? rawId : crypto.randomUUID();
            const title = String(o.title ?? '').trim().slice(0, VN_MAX_TITLE) || 'Ohne Titel';
            const folder =
                o.folder !== undefined && o.folder !== null
                    ? String(o.folder).trim().slice(0, VN_MAX_FOLDER)
                    : undefined;
            const body = String(o.body ?? '').slice(0, VN_MAX_BODY);
            const attachments = sanitizeVaultNoteAttachments(o.attachments);
            const updatedAt =
                typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? Math.floor(o.updatedAt) : Date.now();
            out.push({
                id,
                title,
                ...(folder ? { folder } : {}),
                body,
                ...(attachments.length ? { attachments } : {}),
                updatedAt,
            });
        }
    }
    if (out.length > 0) return out;
    const legacy = (legacyNotes ?? '').trim();
    if (!legacy) return [];
    return [
        {
            id: 'legacy-general',
            title: 'Allgemein',
            body: legacy.slice(0, VN_MAX_BODY),
            updatedAt: Date.now(),
        },
    ];
}

/** Legacy-Feld `notes` für ältere Reader (Zusammenfassung). */
export function vaultNotesToLegacyString(vaultNotes: VaultNoteEntry[]): string {
    if (!vaultNotes.length) return '';
    return vaultNotes
        .map((n) => {
            const head = n.folder?.trim() ? `[${n.folder.trim()}] ${n.title}` : n.title;
            const attHint =
                n.attachments?.length && n.attachments.length > 0
                    ? `\n[${n.attachments.length} Anhang/Anhänge]`
                    : '';
            return `# ${head}\n${n.body}${attHint}`;
        })
        .join('\n\n')
        .slice(0, VAULT_FREETEXT_NOTES_MAX_CHARS);
}

/** Freitext-Notizen im Vault-JSON (nicht Passwortmanager). Begrenzt Blob-Größe / Chain-Kosten; große Journale extern lagern. */
export const VAULT_FREETEXT_NOTES_MAX_CHARS = 500_000;
const PS_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;

/** Normalisiert und begrenzt Safe-Einträge (UI/API → RAM / Vault-JSON). */
export function sanitizePersonalSecrets(raw: unknown): PersonalSecretEntry[] {
    if (!Array.isArray(raw)) return [];
    const out: PersonalSecretEntry[] = [];
    for (const item of raw.slice(0, PS_MAX_ENTRIES)) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const o = item as Record<string, unknown>;
        const rawId = typeof o.id === 'string' ? o.id.trim() : '';
        const id = PS_ID_RE.test(rawId) ? rawId : crypto.randomUUID();
        const title = String(o.title ?? '').trim().slice(0, PS_MAX_TITLE) || 'Ohne Titel';
        const username =
            o.username !== undefined && o.username !== null
                ? String(o.username).trim().slice(0, PS_MAX_USER)
                : undefined;
        const secret =
            o.secret !== undefined && o.secret !== null
                ? String(o.secret).slice(0, PS_MAX_SECRET)
                : undefined;
        const note =
            o.note !== undefined && o.note !== null ? String(o.note).slice(0, PS_MAX_NOTE) : undefined;
        const updatedAt =
            typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? Math.floor(o.updatedAt) : Date.now();
        out.push({
            id,
            title,
            ...(username ? { username } : {}),
            ...(secret !== undefined && secret !== '' ? { secret } : {}),
            ...(note !== undefined && note !== '' ? { note } : {}),
            updatedAt,
        });
    }
    return out;
}

async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const base = await subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    return await subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: Buffer.from(salt),
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/** Payload = PKCS8 + pubRaw + optional IOTA-Signer-Import (Mnemonic ODER Bech32-Secret), alles im AES-GCM-Blob. */
function keysToPayload(
    privateKey: CryptoKey,
    pubRaw: Uint8Array,
    notes?: string,
    iotaSdkSignerImport?: string,
    personalSecrets?: PersonalSecretEntry[],
    vaultNotes?: VaultNoteEntry[]
): Promise<string> {
    return subtle.exportKey('pkcs8', privateKey).then((pkcs8) => {
        const a = Buffer.from(pkcs8).toString('base64');
        const b = Buffer.from(pubRaw).toString('base64');
        const imp = (iotaSdkSignerImport ?? '').trim();
        const sanitizedNotes = sanitizeVaultNotes(vaultNotes, notes);
        const notesTrim = vaultNotesToLegacyString(sanitizedNotes);
        const base: Record<string, unknown> = {
            pkcs8: a,
            pubRaw: b,
            notes: notesTrim,
            vaultNotes: sanitizedNotes,
            personalSecrets: personalSecrets ?? [],
        };
        if (imp) {
            base.iotaSdkSignerImport = imp;
            if (imp.split(/\s+/).filter(Boolean).length >= 12) base.iotaMnemonic = imp;
        }
        return JSON.stringify(base);
    });
}

async function payloadToKeys(payload: string): Promise<VaultKeys> {
    const { pkcs8, pubRaw } = JSON.parse(payload) as { pkcs8: string; pubRaw: string };
    const privateKey = await subtle.importKey(
        'pkcs8',
        Buffer.from(pkcs8, 'base64'),
        { name: 'ECDH', namedCurve: CURVE },
        true,
        ['deriveBits', 'deriveKey']
    );
    const pubRawBytes = new Uint8Array(Buffer.from(pubRaw, 'base64'));
    return { privateKey, pubRaw: pubRawBytes };
}

export type VaultContent = {
    keys: VaultKeys;
    /** Legacy-Zusammenfassung (abgeleitet aus vaultNotes). */
    notes: string;
    vaultNotes: VaultNoteEntry[];
    /** Mnemonic (12+ Wörter) oder IOTA Bech32-Secret (`getSecretKey()` / generate-mnemonic), verschlüsselt im Vault. */
    iotaSdkSignerImport?: string;
    /** Strukturierte Geheimnisse (KeePass-ähnlich), verschlüsselt im selben Blob. */
    personalSecrets: PersonalSecretEntry[];
};

function payloadToContent(payload: string): Promise<VaultContent> {
    const parsed = JSON.parse(payload) as {
        pkcs8?: string;
        pubRaw?: string;
        notes?: string;
        vaultNotes?: unknown;
        iotaMnemonic?: string;
        iotaSdkSignerImport?: string;
        personalSecrets?: unknown;
    };
    const merged =
        (typeof parsed.iotaSdkSignerImport === 'string' && parsed.iotaSdkSignerImport.trim()
            ? parsed.iotaSdkSignerImport.trim()
            : '') ||
        (typeof parsed.iotaMnemonic === 'string' && parsed.iotaMnemonic.trim() ? parsed.iotaMnemonic.trim() : '') ||
        undefined;
    const personalSecrets = sanitizePersonalSecrets(parsed.personalSecrets);
    const vaultNotes = sanitizeVaultNotes(parsed.vaultNotes, parsed.notes);
    const notes = vaultNotesToLegacyString(vaultNotes);
    return payloadToKeys(JSON.stringify({ pkcs8: parsed.pkcs8, pubRaw: parsed.pubRaw })).then((keys) => ({
        keys,
        notes,
        vaultNotes,
        iotaSdkSignerImport: merged,
        personalSecrets,
    }));
}

/** Browser-Direkt-RPC: JWK (oder PKCS#8-Fallback) + Own-Pub aus Vault-Keys. */
export async function exportEcdhKeyMaterialForBrowser(
    keys: VaultKeys
): Promise<
    | { ok: true; ecdhPrivateJwk?: string; ecdhPrivatePkcs8Base64?: string; ecdhPubRawBase64: string }
    | { ok: false; message: string }
> {
    const ecdhPubRawBase64 = Buffer.from(keys.pubRaw).toString('base64');
    try {
        const jwk = await subtle.exportKey('jwk', keys.privateKey);
        return { ok: true, ecdhPrivateJwk: JSON.stringify(jwk), ecdhPubRawBase64 };
    } catch (e) {
        try {
            const pkcs8 = await subtle.exportKey('pkcs8', keys.privateKey);
            return {
                ok: true,
                ecdhPrivatePkcs8Base64: Buffer.from(pkcs8).toString('base64'),
                ecdhPubRawBase64,
            };
        } catch {
            return {
                ok: false,
                message: 'ECDH-Export fehlgeschlagen: ' + String((e as Error)?.message ?? e),
            };
        }
    }
}

/**
 * Keys (und optional Notizen) mit Passwort verschlüsselt in Datei speichern.
 * Datei: salt (16) + iv (12) + ciphertext (inkl. 16-Byte Auth-Tag).
 */
export async function saveVaultLocal(
    keys: VaultKeys,
    password: string,
    filePath: string,
    notes?: string,
    iotaSdkSignerImport?: string,
    personalSecrets?: PersonalSecretEntry[],
    vaultNotes?: VaultNoteEntry[]
): Promise<void> {
    const payload = await keysToPayload(
        keys.privateKey,
        keys.pubRaw,
        notes ?? '',
        iotaSdkSignerImport,
        personalSecrets ?? [],
        vaultNotes
    );
    const salt = crypto.randomBytes(SALT_LEN);
    const key = await deriveKeyFromPassword(password, salt);
    const iv = crypto.randomBytes(IV_LEN);
    const encoded = new TextEncoder().encode(payload);
    const ciphertext = await subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        key,
        encoded
    );
    const out = Buffer.concat([salt, iv, Buffer.from(ciphertext)]);
    const dir = path.dirname(filePath);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, out);
    try { fs.chmodSync(filePath, 0o600); } catch {} // Nur Eigentümer lesbar/schreibbar (Unix)
}

/**
 * Keys aus Datei laden und mit Passwort entschlüsseln (für Start: nur Keys).
 */
export async function loadVaultLocal(password: string, filePath: string): Promise<VaultKeys> {
    const content = await loadVaultContent(password, filePath);
    return content.keys;
}

/**
 * Keys + Notizen aus Datei laden (für UI: Laden und Notizen anzeigen).
 */
export async function loadVaultContent(password: string, filePath: string): Promise<VaultContent> {
    const raw = fs.readFileSync(filePath);
    return loadVaultFromPayload(new Uint8Array(raw), password);
}

/**
 * Keys + Notizen aus Rohdaten (lokal oder On-Chain) entschlüsseln.
 * Format: salt (16) + iv (12) + ciphertext (inkl. 16-Byte Auth-Tag).
 */
export async function loadVaultFromChainPayload(encryptedData: Uint8Array, password: string): Promise<VaultContent> {
    if (encryptedData.length < SALT_LEN + IV_LEN + TAG_LEN) throw new Error('Vault-Payload ungültig (zu kurz).');
    return loadVaultFromPayload(encryptedData, password);
}

async function loadVaultFromPayload(raw: Uint8Array, password: string): Promise<VaultContent> {
    const salt = raw.subarray(0, SALT_LEN);
    const iv = raw.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const ciphertext = raw.subarray(SALT_LEN + IV_LEN);
    const key = await deriveKeyFromPassword(password, new Uint8Array(salt));
    const decrypted = await subtle.decrypt(
        { name: 'AES-GCM', iv: Buffer.from(iv), tagLength: 128 },
        key,
        Buffer.from(ciphertext)
    );
    const payload = new TextDecoder().decode(decrypted);
    return payloadToContent(payload);
}

export function vaultFileExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

/**
 * Lokale Vault-Datei für Unlock/Laden: konfigurierter Pfad, sonst einzige `.morgendrot-vault*` im cwd.
 * Hilft nach Browser-Import unter abweichendem Dateinamen.
 */
export function resolveVaultFilePathForSession(configuredPath?: string, cwd: string = process.cwd()): string {
    const configured = (configuredPath || '').trim();
    const base = configured || '.morgendrot-vault';
    const explicitConfigured = Boolean(configured);
    const candidates = path.isAbsolute(base)
        ? [base]
        : explicitConfigured
          ? [path.join(cwd, base)]
          : [base, path.join(cwd, base)];
    for (const p of candidates) {
        if (vaultFileExists(p)) return p;
    }
    /** Nur ohne explizites VAULT_FILE: einzelne `.morgendrot-vault*` im cwd finden (Import-Fallback). */
    if (!explicitConfigured) {
        const listed = listVaultFiles(cwd);
        if (listed.length === 1) return listed[0]!;
    }
    return path.isAbsolute(base) ? base : path.join(cwd, base);
}

/** Liste Vault-Dateien im Verzeichnis (z. B. .morgendrot-vault, .morgendrot-vault-arbeit). Ohne Sidecars (.handshakes, .inbox, .package-id). */
export function listVaultFiles(dir: string = process.cwd()): string[] {
    try {
        const names = fs.readdirSync(dir);
        const isVaultName = (n: string) =>
            n === '.morgendrot-vault' || (n.startsWith('.morgendrot-vault-') && !n.includes('.'));
        return names
            .filter((n) => isVaultName(n))
            .map((n) => path.join(dir, n))
            .filter((p) => fs.statSync(p).isFile())
            .sort();
    } catch {
        return [];
    }
}

const PACKAGE_ID_SUFFIX = '.package-id';

/**
 * Package-ID neben dem Vault speichern (Klartext – keine Geheimnisse).
 * Die Keys im Vault sind im Kontext dieser Package-ID gültig (Handshakes on-chain).
 */
export function writeVaultPackageId(filePath: string, packageId: string): void {
    const id = (packageId || '').trim();
    if (!id) return;
    const sidecar = filePath + PACKAGE_ID_SUFFIX;
    try {
        fs.writeFileSync(sidecar, id, 'utf-8');
        try { fs.chmodSync(sidecar, 0o600); } catch {}
    } catch (e) {
        // Nicht kritisch – Vault ist gespeichert, nur Sidecar fehlgeschlagen
    }
}

/**
 * Package-ID lesen, die beim Speichern des Vaults gesetzt war (falls vorhanden).
 */
export function readVaultPackageId(filePath: string): string | null {
    const sidecar = filePath + PACKAGE_ID_SUFFIX;
    try {
        if (!fs.existsSync(sidecar)) return null;
        const line = fs.readFileSync(sidecar, 'utf-8').trim();
        return line || null;
    } catch {
        return null;
    }
}

const ANCHOR_ID_SUFFIX = '.streams-anchor';

export async function writeVaultAnchorId(filePath: string, anchorId: string, password: string): Promise<void> {
    const id = (anchorId || '').trim();
    if (!id || !password) return;
    const sidecar = filePath + ANCHOR_ID_SUFFIX;
    try {
        const encrypted = await encryptUtf8ToPayload(id, password);
        fs.writeFileSync(sidecar, Buffer.from(encrypted));
        try { fs.chmodSync(sidecar, 0o600); } catch {}
    } catch {}
}

export async function readVaultAnchorId(filePath: string, password: string): Promise<string | null> {
    const sidecar = filePath + ANCHOR_ID_SUFFIX;
    try {
        if (!fs.existsSync(sidecar)) return null;
        const raw = fs.readFileSync(sidecar);
        if (!raw.length) return null;
        return await decryptPayloadToUtf8(new Uint8Array(raw), password);
    } catch {
        return null;
    }
}

/**
 * Beliebiges UTF-8-Klartext → AES-256-GCM verschlüsseln (gleiches salt+iv+ciphertext-Format wie Vault).
 * Gegenstück: decryptPayloadToUtf8().
 */
export async function encryptUtf8ToPayload(text: string, password: string): Promise<Uint8Array> {
    const salt = crypto.randomBytes(SALT_LEN);
    const key = await deriveKeyFromPassword(password, salt);
    const iv = crypto.randomBytes(IV_LEN);
    const encoded = new TextEncoder().encode(text);
    const ciphertext = await subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        key,
        encoded
    );
    return new Uint8Array(Buffer.concat([salt, iv, Buffer.from(ciphertext)]));
}

/**
 * Verschlüsselte Bytes für On-Chain-Vault (Keys + optional Notizen).
 * Kann von create_vault(registry, encrypted_data, ttl_days) verwendet werden.
 */
export async function encryptVaultPayloadForChain(
    keys: VaultKeys,
    password: string,
    notes?: string,
    iotaSdkSignerImport?: string,
    personalSecrets?: PersonalSecretEntry[],
    vaultNotes?: VaultNoteEntry[]
): Promise<Uint8Array> {
    const payload = await keysToPayload(
        keys.privateKey,
        keys.pubRaw,
        notes ?? '',
        iotaSdkSignerImport,
        personalSecrets ?? [],
        vaultNotes
    );
    const salt = crypto.randomBytes(SALT_LEN);
    const key = await deriveKeyFromPassword(password, salt);
    const iv = crypto.randomBytes(IV_LEN);
    const encoded = new TextEncoder().encode(payload);
    const ciphertext = await subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        key,
        encoded
    );
    return new Uint8Array(Buffer.concat([salt, iv, Buffer.from(ciphertext)]));
}

/**
 * Beliebiges UTF-8-Text-Payload mit gleicher Krypto wie Vault entschlüsseln.
 * Format: salt (16) + iv (12) + ciphertext (AES-GCM, 16-Byte-Tag).
 * Für verschlüsselte .env / Secrets-Dateien (Option B in docs/SECRETS-OPTIONS.md).
 */
export async function decryptPayloadToUtf8(raw: Uint8Array, password: string): Promise<string> {
    if (raw.length < SALT_LEN + IV_LEN + TAG_LEN) throw new Error('Payload zu kurz (erwarte salt+iv+ciphertext).');
    const salt = raw.subarray(0, SALT_LEN);
    const iv = raw.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const ciphertext = raw.subarray(SALT_LEN + IV_LEN);
    const key = await deriveKeyFromPassword(password, new Uint8Array(salt));
    const decrypted = await subtle.decrypt(
        { name: 'AES-GCM', iv: Buffer.from(iv), tagLength: 128 },
        key,
        Buffer.from(ciphertext)
    );
    return new TextDecoder().decode(decrypted);
}

const HANDSHAKES_SUFFIX = '.handshakes.enc';
const SESSION_KEYS_SUFFIX = '.session-keys.enc';
const INBOX_SUFFIX = '.inbox.enc';

export type HandshakeCacheEntry = { pubKeyRaw: string; nonce: string };
export type InboxCacheEntry = {
    sender: string;
    recipient: string;
    nonce: string;
    text: string;
    ts: number;
    /** Ab wann gespeichert: nur beim Merge mit passender PACKAGE_ID anzeigen */
    packageId?: string;
};

/** Pfad der Handshake-Cache-Datei (verschlüsselt, gleiches Passwort wie Vault). Immer purgbar. */
export function handshakeCachePath(vaultPath: string): string {
    return vaultPath + HANDSHAKES_SUFFIX;
}

/** Pfad des Session-Key-Archivs (§ H.23 A3). */
export function sessionKeysArchivePath(vaultPath: string): string {
    return vaultPath + SESSION_KEYS_SUFFIX;
}

/** Pfad der lokalen Inbox-Cache-Datei (verschlüsselt). Immer purgbar. */
export function inboxCachePath(vaultPath: string): string {
    return vaultPath + INBOX_SUFFIX;
}

/** Verschlüsseltes JSON in Datei schreiben (gleiche Krypto wie Vault). */
export async function saveEncryptedJson(filePath: string, password: string, data: object): Promise<void> {
    const raw = await encryptUtf8ToPayload(JSON.stringify(data), password);
    const dir = path.dirname(filePath);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(raw));
    try { fs.chmodSync(filePath, 0o600); } catch {}
}

/** Verschlüsseltes JSON aus Datei lesen. Gibt null wenn Datei fehlt oder Entschlüsselung fehlschlägt. */
export async function loadEncryptedJson(filePath: string, password: string): Promise<object | null> {
    try {
        if (!fs.existsSync(filePath)) return null;
        const raw = new Uint8Array(fs.readFileSync(filePath));
        const utf8 = await decryptPayloadToUtf8(raw, password);
        return JSON.parse(utf8) as object;
    } catch {
        return null;
    }
}

/** Handshake-Cache laden: Map Partner-Adresse → { pubKeyRaw, handshakeNonce }. Purgable. */
export async function loadHandshakeCache(vaultPath: string, password: string): Promise<Map<string, { pubKeyRaw: Uint8Array; handshakeNonce: bigint }>> {
    const p = handshakeCachePath(vaultPath);
    const obj = await loadEncryptedJson(p, password);
    const peers = (obj as { peers?: Record<string, HandshakeCacheEntry> })?.peers ?? {};
    const out = new Map<string, { pubKeyRaw: Uint8Array; handshakeNonce: bigint }>();
    for (const [addr, e] of Object.entries(peers)) {
        if (e?.pubKeyRaw && e?.nonce != null) {
            try {
                out.set(addr, {
                    pubKeyRaw: new Uint8Array(Buffer.from(e.pubKeyRaw, 'base64')),
                    handshakeNonce: BigInt(e.nonce),
                });
            } catch {}
        }
    }
    return out;
}

/** Handshake-Cache speichern (z. B. nach Connect). Purgable durch Löschen der Datei oder leeres Objekt. */
export async function saveHandshakeCache(
    vaultPath: string,
    password: string,
    peers: Map<string, { pubKeyRaw: Uint8Array; handshakeNonce: bigint }>
): Promise<void> {
    const peersObj: Record<string, HandshakeCacheEntry> = {};
    for (const [addr, e] of peers) {
        peersObj[addr] = {
            pubKeyRaw: Buffer.from(e.pubKeyRaw).toString('base64'),
            nonce: String(e.handshakeNonce),
        };
    }
    await saveEncryptedJson(handshakeCachePath(vaultPath), password, { peers: peersObj });
    const sessionFile = mergeSessionKeysFromHandshakePeers(
        await loadSessionKeysArchive(vaultPath, password),
        peers
    );
    await saveSessionKeysArchive(vaultPath, password, sessionFile);
}

/** Session-Key-Archiv laden (§ H.23 A3). */
export async function loadSessionKeysArchive(
    vaultPath: string,
    password: string
): Promise<SessionKeysArchiveFile> {
    const obj = await loadEncryptedJson(sessionKeysArchivePath(vaultPath), password);
    return deserializeSessionKeysArchive(obj);
}

/** Session-Key-Archiv speichern. */
export async function saveSessionKeysArchive(
    vaultPath: string,
    password: string,
    file: SessionKeysArchiveFile
): Promise<void> {
    await saveEncryptedJson(sessionKeysArchivePath(vaultPath), password, file);
}

/** Session-Key-Archiv leeren (purgable). */
export function purgeSessionKeysArchive(vaultPath: string, options?: PurgeLocalCacheOptions): void {
    const p = sessionKeysArchivePath(vaultPath);
    try {
        if (!fs.existsSync(p)) return;
        if (options?.shred === true) shredFileSync(p);
        else fs.unlinkSync(p);
    } catch {}
}

/**
 * Datei mit Zufallsbytes überschreiben und löschen (best effort; kein Garant für SSD/TRIM).
 */
export function shredFileSync(filePath: string): void {
    try {
        if (!fs.existsSync(filePath)) return;
        const size = fs.statSync(filePath).size;
        if (size === 0) {
            fs.unlinkSync(filePath);
            return;
        }
        const fd = fs.openSync(filePath, 'r+');
        try {
            let offset = 0;
            const chunkSize = 65536;
            while (offset < size) {
                const len = Math.min(chunkSize, size - offset);
                const buf = crypto.randomBytes(len);
                fs.writeSync(fd, buf, 0, len, offset);
                offset += len;
            }
            fs.fsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.unlinkSync(filePath);
    } catch {
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
    }
}

export type PurgeLocalCacheOptions = { shred?: boolean };

/** Handshake-Cache leeren (purgable). */
export function purgeHandshakeCache(vaultPath: string, options?: PurgeLocalCacheOptions): void {
    const p = handshakeCachePath(vaultPath);
    try {
        if (!fs.existsSync(p)) return;
        if (options?.shred === true) shredFileSync(p);
        else fs.unlinkSync(p);
    } catch {}
}

/** Lokale Inbox-Cache laden. Purgable. */
export async function loadInboxCache(vaultPath: string, password: string): Promise<InboxCacheEntry[]> {
    const obj = await loadEncryptedJson(inboxCachePath(vaultPath), password);
    const list = (obj as { messages?: InboxCacheEntry[] })?.messages ?? [];
    return Array.isArray(list) ? list : [];
}

/** Eine entschlüsselte Nachricht zur Inbox-Cache hinzufügen (append). */
export async function appendInboxCache(
    vaultPath: string,
    password: string,
    entry: InboxCacheEntry,
    maxEntries: number = 500
): Promise<void> {
    const list = await loadInboxCache(vaultPath, password);
    const key = (e: InboxCacheEntry) => `${e.sender}:${e.nonce}`;
    const newKey = key(entry);
    const filtered = list.filter((e) => key(e) !== newKey);
    filtered.push(entry);
    const trimmed = filtered.slice(-maxEntries);
    await saveEncryptedJson(inboxCachePath(vaultPath), password, { messages: trimmed });
}

/** Lokale Inbox-Cache leeren (purgable). optional shred = Überschreiben vor dem Löschen. */
export function purgeInboxCache(vaultPath: string, options?: PurgeLocalCacheOptions): void {
    const p = inboxCachePath(vaultPath);
    try {
        if (!fs.existsSync(p)) return;
        if (options?.shred === true) shredFileSync(p);
        else fs.unlinkSync(p);
    } catch {}
}

/** Inbox (+ optional Handshake-Cache) – „lokaler Chat-/Peering-Abfall“. */
export function clearLocalMessengerCaches(
    vaultPath: string,
    opts?: { shred?: boolean; includeHandshakeCache?: boolean }
): void {
    const shred = opts?.shred === true;
    purgeInboxCache(vaultPath, { shred });
    if (opts?.includeHandshakeCache) {
        purgeHandshakeCache(vaultPath, { shred });
        purgeSessionKeysArchive(vaultPath, { shred });
    }
}
