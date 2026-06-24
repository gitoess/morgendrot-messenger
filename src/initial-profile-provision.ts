/**
 * Optionales Paket für POST /api/provision-device: lokale Kontext-Daten (Kontakte, Tags)
 * nach dem Start — nicht auf der Chain; siehe docs/API-INITIAL-PROFILE.md.
 */

function isValidIotaAddress64(s: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(String(s).trim());
}

export const INITIAL_PROFILE_VERSION = 1 as const;

/** Maximale UTF-8-Größe des serialisierten Profils (Schutz vor übergroßen Payloads). */
export const INITIAL_PROFILE_MAX_BYTES = 65536;

export const INITIAL_PROFILE_MAX_CONTACTS = 200;
/** Flache Metadata: max. Anzahl Schlüssel (v1). */
export const INITIAL_PROFILE_METADATA_MAX_KEYS = 48;
const MAX_NAME_LEN = 120;
const MAX_CHANNEL_TAG_LEN = 120;
const MAX_TAGS_PER_CONTACT = 20;
const MAX_TAG_LEN = 48;
const MAX_METADATA_KEY_LEN = 64;
const MAX_METADATA_VALUE_LEN = 2048;
const METADATA_KEY_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;
/** Kurznotiz für Offline/Einsatz (Boss → Helfer), Klartext im Paket — siehe docs/API-INITIAL-PROFILE.md */
export const INITIAL_PROFILE_OFFLINE_BRIEFING_MAX = 2000;

export type InitialProfileContact = {
    name: string;
    /** IOTA-Adresse 0x + 64 Hex */
    address: string;
    /** z. B. „Einsatzleiter“, „Medic“ — nur Anzeige, keine Chain-Rolle */
    roleTags?: string[];
    /** Meshtastic Node ID, z. B. !a1b2c3d4 */
    meshNodeId?: string;
    /** Telegram Chat-ID (Kurz-Hinweis nach Send). */
    telegramChatId?: string;
    /** Optionale Mailbox-Slots (0x + 64 Hex). */
    mailboxObjectId?: string;
    mailboxSharedId?: string;
    mailboxPrivateId?: string;
    mailboxTeamId?: string;
    mailboxBufferId?: string;
};

export type InitialProfile = {
    version: typeof INITIAL_PROFILE_VERSION;
    /** Freitext z. B. „Sektor Nord“ — Filter/Anzeige, kein Chain-Kanal */
    deploymentChannelTag?: string;
    contacts: InitialProfileContact[];
    /**
     * Freie Schlüssel/Werte (nur Strings in v1); z. B. teamId, visibilityHint, shared_waypoints als JSON-String.
     * Keine Durchsetzung von Sichtbarkeit — nur Transport. Siehe docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md
     */
    metadata?: Record<string, string>;
    /**
     * Optional: Unix-Zeit in Millisekunden — nach Ablauf sollen Clients lokale Profildaten entsorgen (Honor-System).
     */
    validUntil?: number;
    /**
     * Optional: 3–4 Sätze „Was tun bei Funkabbruch?“ — **Klartext** im Provisioning-Paket.
     * Kein Ersatz für Vault-Verschlüsselung; Anzeige in der PWA nach Import möglich.
     */
    offlineBriefing?: string;
};

function trimStr(s: unknown, max: number): string {
    const t = String(s ?? '').trim();
    return t.length > max ? t.slice(0, max) : t;
}

function parseOptionalMeshNodeId(raw: unknown): { ok: true; value?: string } | { ok: false; error: string } {
    if (raw === undefined || raw === null || raw === '') return { ok: true };
    const s = String(raw).trim();
    if (!s.startsWith('!')) return { ok: false, error: 'muss mit ! beginnen' };
    const hex = s.slice(1).toLowerCase();
    if (!/^[0-9a-f]{1,64}$/.test(hex)) return { ok: false, error: 'ungültiges Hex nach !' };
    return { ok: true, value: `!${hex}` };
}

function parseOptionalTelegramChatId(raw: unknown): { ok: true; value?: string } | { ok: false; error: string } {
    if (raw === undefined || raw === null || raw === '') return { ok: true };
    const t = String(raw).trim();
    if (!/^-?\d{1,20}$/.test(t)) return { ok: false, error: 'ungültige Chat-ID' };
    return { ok: true, value: t };
}

function parseOptionalMailboxId(
    raw: unknown,
    field: string,
    index: number
): { ok: true; value?: string } | { ok: false; error: string } {
    if (raw === undefined || raw === null || raw === '') return { ok: true };
    const id = String(raw).trim().toLowerCase();
    if (!isValidIotaAddress64(id)) {
        return { ok: false, error: 'initialProfile.contacts[' + index + '].' + field + ': gültige 0x+64Hex-Adresse erforderlich.' };
    }
    return { ok: true, value: id };
}

function parseMetadataField(raw: unknown): { ok: true; metadata: Record<string, string> } | { ok: false; error: string } {
    if (raw === undefined || raw === null) {
        return { ok: true, metadata: {} };
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: 'initialProfile.metadata muss ein Objekt sein.' };
    }
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length > INITIAL_PROFILE_METADATA_MAX_KEYS) {
        return { ok: false, error: 'initialProfile.metadata: maximal ' + INITIAL_PROFILE_METADATA_MAX_KEYS + ' Schlüssel.' };
    }
    const out: Record<string, string> = {};
    for (const k of keys) {
        if (k.length > MAX_METADATA_KEY_LEN || !METADATA_KEY_REGEX.test(k)) {
            return { ok: false, error: 'initialProfile.metadata: ungültiger Schlüssel „' + k + '“ (nur A–Z, a–z, 0–9, _ . -).' };
        }
        const v = o[k];
        if (v === null || v === undefined) continue;
        if (typeof v === 'object') {
            return { ok: false, error: 'initialProfile.metadata[„' + k + '“]: in v1 nur String/Zahl/Bool — Objekte als JSON-String speichern.' };
        }
        const s = typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
        const t = s.trim().slice(0, MAX_METADATA_VALUE_LEN);
        if (t) out[k] = t;
    }
    return { ok: true, metadata: out };
}

/**
 * Prüft und normalisiert `initialProfile` aus dem Provision-JSON-Body.
 * Unbekannte Felder im Root werden ignoriert (außer dokumentierte optional).
 */
export function parseAndValidateInitialProfile(raw: unknown): { ok: true; profile: InitialProfile } | { ok: false; error: string } {
    if (raw === null || raw === undefined) {
        return { ok: false, error: 'initialProfile fehlt oder ist null.' };
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: 'initialProfile muss ein JSON-Objekt sein.' };
    }
    const o = raw as Record<string, unknown>;
    const ver = o.version;
    if (ver !== INITIAL_PROFILE_VERSION) {
        return { ok: false, error: 'initialProfile.version muss ' + INITIAL_PROFILE_VERSION + ' sein.' };
    }
    const contactsRaw = o.contacts;
    if (!Array.isArray(contactsRaw)) {
        return { ok: false, error: 'initialProfile.contacts muss ein Array sein.' };
    }
    if (contactsRaw.length > INITIAL_PROFILE_MAX_CONTACTS) {
        return { ok: false, error: 'initialProfile.contacts: maximal ' + INITIAL_PROFILE_MAX_CONTACTS + ' Einträge.' };
    }
    const deploymentChannelTag =
        o.deploymentChannelTag === undefined || o.deploymentChannelTag === null || o.deploymentChannelTag === ''
            ? undefined
            : trimStr(o.deploymentChannelTag, MAX_CHANNEL_TAG_LEN);

    const metaParsed = parseMetadataField(o.metadata);
    if (!metaParsed.ok) return metaParsed;
    const metadataKeys = Object.keys(metaParsed.metadata);
    const metadata = metadataKeys.length ? metaParsed.metadata : undefined;

    let validUntil: number | undefined;
    if (o.validUntil !== undefined && o.validUntil !== null) {
        const n = typeof o.validUntil === 'number' ? o.validUntil : parseFloat(String(o.validUntil));
        if (!Number.isFinite(n)) {
            return { ok: false, error: 'initialProfile.validUntil muss eine endliche Zahl sein (Unix-ms empfohlen).' };
        }
        validUntil = n;
    }

    let offlineBriefing: string | undefined;
    if (o.offlineBriefing !== undefined && o.offlineBriefing !== null) {
        const t = trimStr(o.offlineBriefing, INITIAL_PROFILE_OFFLINE_BRIEFING_MAX);
        if (t) offlineBriefing = t;
    }

    const contacts: InitialProfileContact[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < contactsRaw.length; i++) {
        const c = contactsRaw[i];
        if (typeof c !== 'object' || c === null || Array.isArray(c)) {
            return { ok: false, error: 'initialProfile.contacts[' + i + '] muss ein Objekt sein.' };
        }
        const co = c as Record<string, unknown>;
        const name = trimStr(co.name, MAX_NAME_LEN);
        if (!name) {
            return { ok: false, error: 'initialProfile.contacts[' + i + '].name darf nicht leer sein.' };
        }
        const addr = String(co.address ?? '').trim();
        if (!isValidIotaAddress64(addr)) {
            return { ok: false, error: 'initialProfile.contacts[' + i + '].address: gültige 0x+64Hex-Adresse erforderlich.' };
        }
        const key = addr.toLowerCase();
        if (seen.has(key)) {
            return { ok: false, error: 'initialProfile.contacts: doppelte Adresse ' + addr.slice(0, 18) + '…' };
        }
        seen.add(key);

        let roleTags: string[] | undefined;
        if (co.roleTags !== undefined && co.roleTags !== null) {
            if (!Array.isArray(co.roleTags)) {
                return { ok: false, error: 'initialProfile.contacts[' + i + '].roleTags muss ein Array sein.' };
            }
            if (co.roleTags.length > MAX_TAGS_PER_CONTACT) {
                return { ok: false, error: 'initialProfile.contacts[' + i + '].roleTags: maximal ' + MAX_TAGS_PER_CONTACT + ' Einträge.' };
            }
            const tags: string[] = [];
            for (let j = 0; j < co.roleTags.length; j++) {
                const tag = trimStr(co.roleTags[j], MAX_TAG_LEN);
                if (tag) tags.push(tag);
            }
            if (tags.length) roleTags = tags;
        }

        const optionalMesh = parseOptionalMeshNodeId(co.meshNodeId);
        if (optionalMesh.ok === false) {
            return { ok: false, error: 'initialProfile.contacts[' + i + '].meshNodeId: ' + optionalMesh.error };
        }
        const optionalTg = parseOptionalTelegramChatId(co.telegramChatId);
        if (optionalTg.ok === false) {
            return { ok: false, error: 'initialProfile.contacts[' + i + '].telegramChatId: ' + optionalTg.error };
        }
        const mbShared = parseOptionalMailboxId(co.mailboxSharedId, 'mailboxSharedId', i);
        if (mbShared.ok === false) return mbShared;
        const mbPrivate = parseOptionalMailboxId(co.mailboxPrivateId, 'mailboxPrivateId', i);
        if (mbPrivate.ok === false) return mbPrivate;
        const mbTeam = parseOptionalMailboxId(co.mailboxTeamId, 'mailboxTeamId', i);
        if (mbTeam.ok === false) return mbTeam;
        const mbBuffer = parseOptionalMailboxId(co.mailboxBufferId, 'mailboxBufferId', i);
        if (mbBuffer.ok === false) return mbBuffer;
        const mbObject = parseOptionalMailboxId(co.mailboxObjectId, 'mailboxObjectId', i);
        if (mbObject.ok === false) return mbObject;

        contacts.push({
            name,
            address: addr,
            ...(roleTags ? { roleTags } : {}),
            ...(optionalMesh.value ? { meshNodeId: optionalMesh.value } : {}),
            ...(optionalTg.value ? { telegramChatId: optionalTg.value } : {}),
            ...(mbObject.value ? { mailboxObjectId: mbObject.value } : {}),
            ...(mbShared.value ? { mailboxSharedId: mbShared.value } : {}),
            ...(mbPrivate.value ? { mailboxPrivateId: mbPrivate.value } : {}),
            ...(mbTeam.value ? { mailboxTeamId: mbTeam.value } : {}),
            ...(mbBuffer.value ? { mailboxBufferId: mbBuffer.value } : {}),
        });
    }

    const profile: InitialProfile = {
        version: INITIAL_PROFILE_VERSION,
        ...(deploymentChannelTag ? { deploymentChannelTag } : {}),
        contacts,
        ...(metadata ? { metadata } : {}),
        ...(validUntil !== undefined ? { validUntil } : {}),
        ...(offlineBriefing ? { offlineBriefing } : {}),
    };

    const serialized = JSON.stringify(profile);
    if (Buffer.byteLength(serialized, 'utf8') > INITIAL_PROFILE_MAX_BYTES) {
        return { ok: false, error: 'initialProfile zu groß (max. ' + INITIAL_PROFILE_MAX_BYTES + ' Bytes UTF-8).' };
    }

    return { ok: true, profile };
}
