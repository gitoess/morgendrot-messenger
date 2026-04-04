/**
 * Emergency Wire v2 – kompaktes Binärformat (LoRa / Meshtastic App-Port).
 * Hinweis: Haupt-Repo-Spiegel unter `src/emergency-binary-wire.ts` – Logik dort bei Änderungen mitpflegen.
 * Versionsbyte `0x02` ist in `../src/shared/opcodes.ts` als `EmergencyBinaryWireVersionByte` dokumentiert (Registry).
 *
 * Layout:
 * [0]     uint8  version = 2
 * [1..4]  uint32 BE nonce (Replay-Dedup pro Absender-Fingerprint)
 * [5..36] 32 Byte SHA-256(UTF-8(IOTA-Adresse lowercase 0x+64hex))
 * [37..]  Rohbytes: App-E2EE-Ciphertext (inkl. ggf. innerer Nonce/Tag)
 */
import { createHash } from 'node:crypto';

export const EMERGENCY_BINARY_VERSION = 2;
const HEADER_LEN = 37;

function normalizeIotaAddress(addr: string): string | null {
    const a = (addr || '').trim().toLowerCase();
    return /^0x[a-f0-9]{64}$/.test(a) ? a : null;
}

export function senderFingerprint32(address: string): Buffer {
    const norm = normalizeIotaAddress(address);
    if (!norm) throw new Error('senderAddress muss 0x + 64 Hex sein');
    return createHash('sha256').update(norm, 'utf8').digest();
}

export type EmergencyBinaryV2Parsed = {
    nonce: number;
    fingerprintHex: string;
    ciphertext: Uint8Array;
};

export function buildEmergencyBinaryV2(
    senderAddress: string,
    nonce: number,
    ciphertext: Uint8Array,
    maxTotalBytes: number
): { ok: true; wire: Uint8Array } | { ok: false; error: string } {
    if (!Number.isInteger(nonce) || nonce < 0 || nonce > 0xffffffff) {
        return { ok: false, error: 'nonce muss uint32 sein' };
    }
    let fp: Buffer;
    try {
        fp = senderFingerprint32(senderAddress);
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
    const ct = ciphertext;
    const total = HEADER_LEN + ct.length;
    if (total > maxTotalBytes) {
        return { ok: false, error: `wire ${total} bytes (max ${maxTotalBytes})` };
    }
    const wire = new Uint8Array(total);
    wire[0] = EMERGENCY_BINARY_VERSION;
    wire[1] = (nonce >>> 24) & 0xff;
    wire[2] = (nonce >>> 16) & 0xff;
    wire[3] = (nonce >>> 8) & 0xff;
    wire[4] = nonce & 0xff;
    wire.set(fp, 5);
    wire.set(ct, HEADER_LEN);
    return { ok: true, wire };
}

export function tryParseEmergencyBinaryV2(
    raw: Uint8Array,
    maxTotalBytes: number
): EmergencyBinaryV2Parsed | null {
    if (raw.length < HEADER_LEN || raw[0] !== EMERGENCY_BINARY_VERSION) return null;
    if (raw.length > maxTotalBytes) return null;
    const nonce = (raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4];
    const fp = raw.slice(5, 37);
    const ciphertext = raw.slice(37);
    return {
        nonce: nonce >>> 0,
        fingerprintHex: Buffer.from(fp).toString('hex'),
        ciphertext,
    };
}

/** Latin1-String ↔ Bytes (für stringbasierte ILoraDriver-Payload). */
export function binaryWireToLatin1(wire: Uint8Array): string {
    return Buffer.from(wire).toString('latin1');
}

export function latin1ToBinaryWire(s: string): Uint8Array {
    return Uint8Array.from(Buffer.from(s, 'latin1'));
}
