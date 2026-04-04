/**
 * Notfall-Umschlag v1 – Meshtastic/LoRa als reiner Transport.
 * Klartext liegt nur in der App nach Entschlüsselung von `b`; die Bridge prüft nur Form und Größe.
 *
 * Workflow: Online (IOTA) Handshake → gemeinsame Schlüssel/Material im Vault → offline nur noch
 * Ciphertext in `b` (Base64). Optional `t: pay` für Testnet (Sender wird vertraut).
 */

export const EMERGENCY_ENVELOPE_VERSION = 1 as const;

export type EmergencyKind = 'text' | 'pay';

export interface EmergencyEnvelopeV1 {
    v: typeof EMERGENCY_ENVELOPE_VERSION;
    t: EmergencyKind;
    /** Kurz-Fingerprint des Absenders (z. B. gekürzte IOTA-Adresse), aus Vault nach Online-Kontakt */
    f: string;
    /** Nonce gegen einfaches Replay (pro Absender lokal deduplizieren) */
    n: number;
    /** Base64: App-E2EE-Ciphertext */
    b: string;
    /** Nur bei t === 'pay': Ziel und Betrag (Testnet, vertrauensbasiert) */
    pay?: { to: string; amount: string };
}

const B64_RE = /^[A-Za-z0-9+/]+=*$/;

/** Maximale dekodierte Länge von `b` (Richtwert für ~1 LoRa-Paket inkl. JSON-Umschlag). */
export const MAX_B_DECODED_BYTES = 160;

function base64DecodedLength(b64: string): number {
    const len = b64.length;
    if (len < 4) return 0;
    const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.floor((len * 3) / 4) - pad;
}

function isSafeInt(n: number): boolean {
    return Number.isInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
}

/**
 * Validiert einen Emergency-Umschlag und liefert die kanonische JSON-Zeile für LoRa (ohne Pretty-Print).
 */
export function validateEmergencyEnvelope(
    raw: unknown,
    maxWireBytes: number
): { ok: true; wire: string; envelope: EmergencyEnvelopeV1 } | { ok: false; error: string } {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: 'emergency must be a non-array object' };
    }
    const o = raw as Record<string, unknown>;
    if (o.v !== EMERGENCY_ENVELOPE_VERSION) {
        return { ok: false, error: 'v must be 1' };
    }
    const t = o.t;
    if (t !== 'text' && t !== 'pay') {
        return { ok: false, error: 't must be "text" or "pay"' };
    }
    const f = typeof o.f === 'string' ? o.f.trim() : '';
    if (!f || f.length > 36) {
        return { ok: false, error: 'f must be non-empty string, max 36 chars' };
    }
    const n = o.n;
    if (typeof n !== 'number' || !isSafeInt(n)) {
        return { ok: false, error: 'n must be a non-negative safe integer' };
    }
    const b = typeof o.b === 'string' ? o.b.replace(/\s/g, '') : '';
    if (!b || !B64_RE.test(b)) {
        return { ok: false, error: 'b must be non-empty base64' };
    }
    const decLen = base64DecodedLength(b);
    if (decLen > MAX_B_DECODED_BYTES) {
        return { ok: false, error: `b decodes to ${decLen} bytes (max ${MAX_B_DECODED_BYTES})` };
    }

    if (t === 'text' && o.pay !== undefined) {
        return { ok: false, error: 'pay must not be set when t is text' };
    }

    let pay: EmergencyEnvelopeV1['pay'];
    if (t === 'pay') {
        const p = o.pay;
        if (!p || typeof p !== 'object' || Array.isArray(p)) {
            return { ok: false, error: 'pay object required when t is pay' };
        }
        const pr = p as Record<string, unknown>;
        const to = typeof pr.to === 'string' ? pr.to.trim() : '';
        const amount = typeof pr.amount === 'string' ? pr.amount.trim() : '';
        if (!to || to.length > 66) {
            return { ok: false, error: 'pay.to invalid (max 66 chars)' };
        }
        if (!amount || amount.length > 32) {
            return { ok: false, error: 'pay.amount invalid (max 32 chars)' };
        }
        pay = { to, amount };
    }

    const envelope: EmergencyEnvelopeV1 = { v: 1, t, f, n, b, ...(pay && { pay }) };
    const wire = JSON.stringify(envelope);
    const bytes = new TextEncoder().encode(wire).length;
    if (bytes > maxWireBytes) {
        return { ok: false, error: `wire JSON is ${bytes} bytes (max ${maxWireBytes})` };
    }
    return { ok: true, wire, envelope };
}

/** Erkennt und validiert Emergency-v1-JSON (z. B. vom Funk). */
export function tryParseEmergencyWire(payload: string, maxWireBytes: number): EmergencyEnvelopeV1 | null {
    try {
        const o = JSON.parse(payload) as Record<string, unknown>;
        const r = validateEmergencyEnvelope(o, maxWireBytes);
        return r.ok ? r.envelope : null;
    } catch {
        return null;
    }
}
