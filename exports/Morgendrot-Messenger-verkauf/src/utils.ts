/**
 * Gemeinsame Hilfsfunktionen für wallet-bridge und m2m-lock.
 * Vermeidet Duplikate und sorgt für konsistente Adress-/Bytes-Normalisierung.
 */
export function normalizeAddress(addr: string | undefined): string {
    return (addr || '').trim().toLowerCase();
}

export function toEventBytes(val: unknown): Uint8Array {
    if (val == null) return new Uint8Array(0);
    if (val instanceof Uint8Array) return val;
    if (Array.isArray(val)) return new Uint8Array(val as number[]);
    if (typeof val === 'string') return new Uint8Array(Buffer.from(val, 'base64'));
    return new Uint8Array(0);
}

/**
 * Move-Event parsedJson: vector<u8> oft als number[], manchmal Base64 oder 0x-Hex (RPC/Version).
 */
export function coerceParsedJsonByteVector(val: unknown): Uint8Array | null {
    if (val == null) return null;
    if (val instanceof Uint8Array) return val.length ? new Uint8Array(val) : null;
    if (Array.isArray(val)) {
        const a = val as unknown[];
        if (a.length === 0) return null;
        for (const x of a) {
            if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x > 255) return null;
        }
        return new Uint8Array(a as number[]);
    }
    if (typeof val === 'string') {
        const s = val.trim();
        if (!s) return null;
        if (/^0x[0-9a-fA-F]+$/.test(s)) {
            const hex = s.slice(2);
            if (hex.length % 2 !== 0) return null;
            try {
                const buf = Buffer.from(hex, 'hex');
                return buf.length ? new Uint8Array(buf) : null;
            } catch {
                return null;
            }
        }
        try {
            const buf = Buffer.from(s, 'base64');
            return buf.length ? new Uint8Array(buf) : null;
        } catch {
            return null;
        }
    }
    return null;
}
