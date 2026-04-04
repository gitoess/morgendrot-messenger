/**
 * Geheimnis-Peering: AES-256-GCM, Schlüssel per HKDF-SHA256 aus UTF-8-Geheimnis + öffentlichem Nonce.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';

const PAIRING_INFO = Buffer.from('morgendrot-pairing-v1', 'utf8');
const MIN_SECRET_LEN = 6;
const MAX_SECRET_LEN = 512;
const NONCE_LEN = 16;

export type PairingPayloadV1 = {
    v: 1;
    address: string;
    displayName: string;
    expiresAtMs: number;
};

function deriveKey(secretUtf8: string, nonce: Uint8Array): Buffer {
    const ikm = Buffer.from(secretUtf8, 'utf8');
    const salt = Buffer.from(nonce);
    return Buffer.from(hkdfSync('sha256', ikm, salt, PAIRING_INFO, 32));
}

export function generatePairingNonce(): Uint8Array {
    return new Uint8Array(randomBytes(NONCE_LEN));
}

export function encryptPairingPayload(secret: string, nonce: Uint8Array, payload: PairingPayloadV1): Uint8Array {
    const s = secret.trim();
    if (s.length < MIN_SECRET_LEN || s.length > MAX_SECRET_LEN) {
        throw new Error(`Geheimnis: ${MIN_SECRET_LEN}–${MAX_SECRET_LEN} Zeichen.`);
    }
    if (nonce.length < 8 || nonce.length > 64) throw new Error('Internes Nonce ungültig.');
    const key = deriveKey(s, nonce);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const pt = Buffer.from(JSON.stringify(payload), 'utf8');
    const enc = Buffer.concat([cipher.update(pt), cipher.final()]);
    const tag = cipher.getAuthTag();
    return new Uint8Array(Buffer.concat([iv, tag, enc]));
}

export function decryptPairingPayload(secret: string, nonce: Uint8Array, data: Uint8Array): PairingPayloadV1 | null {
    const s = secret.trim();
    if (s.length < MIN_SECRET_LEN || s.length > MAX_SECRET_LEN) return null;
    try {
        const buf = Buffer.from(data);
        if (buf.length < 12 + 16 + 1) return null;
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const ciphertext = buf.subarray(28);
        const key = deriveKey(s, nonce);
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const pt = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        const o = JSON.parse(pt.toString('utf8')) as PairingPayloadV1;
        if (!o || o.v !== 1 || typeof o.address !== 'string') return null;
        return o;
    } catch {
        return null;
    }
}

export { MIN_SECRET_LEN, MAX_SECRET_LEN, NONCE_LEN };
