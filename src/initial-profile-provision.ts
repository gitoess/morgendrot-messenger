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
const MAX_NAME_LEN = 120;
const MAX_CHANNEL_TAG_LEN = 120;
const MAX_TAGS_PER_CONTACT = 20;
const MAX_TAG_LEN = 48;

export type InitialProfileContact = {
    name: string;
    /** IOTA-Adresse 0x + 64 Hex */
    address: string;
    /** z. B. „Einsatzleiter“, „Medic“ — nur Anzeige, keine Chain-Rolle */
    roleTags?: string[];
};

export type InitialProfile = {
    version: typeof INITIAL_PROFILE_VERSION;
    /** Freitext z. B. „Sektor Nord“ — Filter/Anzeige, kein Chain-Kanal */
    deploymentChannelTag?: string;
    contacts: InitialProfileContact[];
};

function trimStr(s: unknown, max: number): string {
    const t = String(s ?? '').trim();
    return t.length > max ? t.slice(0, max) : t;
}

/**
 * Prüft und normalisiert `initialProfile` aus dem Provision-JSON-Body.
 * Unbekannte Felder im Root werden ignoriert.
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

        contacts.push({ name, address: addr, ...(roleTags ? { roleTags } : {}) });
    }

    const profile: InitialProfile = {
        version: INITIAL_PROFILE_VERSION,
        ...(deploymentChannelTag ? { deploymentChannelTag } : {}),
        contacts,
    };

    const serialized = JSON.stringify(profile);
    if (Buffer.byteLength(serialized, 'utf8') > INITIAL_PROFILE_MAX_BYTES) {
        return { ok: false, error: 'initialProfile zu groß (max. ' + INITIAL_PROFILE_MAX_BYTES + ' Bytes UTF-8).' };
    }

    return { ok: true, profile };
}
