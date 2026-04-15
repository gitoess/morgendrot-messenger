/**
 * Emergency Wire v2 – kompaktes Binärformat (LoRa / Meshtastic App-Port).
 * Nur Web Crypto (SHA-256) + Uint8Array – kein node:crypto / Buffer.
 * Spiegel: `lora-bridge/src/emergency-binary.ts` bei Protokoll-Änderungen angleichen.
 */
import { uint8ToHex } from './bytes-base64';
import { EmergencyBinaryWireVersionByte } from './opcodes';

export const EMERGENCY_BINARY_VERSION = EmergencyBinaryWireVersionByte;
const HEADER_LEN = 37;

function normalizeIotaAddress(addr: string): string | null {
  const a = (addr || '').trim().toLowerCase();
  return /^0x[a-f0-9]{64}$/.test(a) ? a : null;
}

export async function senderFingerprint32(address: string): Promise<Uint8Array> {
  const norm = normalizeIotaAddress(address);
  if (!norm) throw new Error('senderAddress muss 0x + 64 Hex sein');
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto fehlt');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(norm));
  return new Uint8Array(digest);
}

export type EmergencyBinaryV2Parsed = {
  nonce: number;
  fingerprintHex: string;
  ciphertext: Uint8Array;
};

export async function buildEmergencyBinaryV2(
  senderAddress: string,
  nonce: number,
  ciphertext: Uint8Array,
  maxTotalBytes: number
): Promise<{ ok: true; wire: Uint8Array } | { ok: false; error: string }> {
  if (!Number.isInteger(nonce) || nonce < 0 || nonce > 0xffffffff) {
    return { ok: false, error: 'nonce muss uint32 sein' };
  }
  let fp: Uint8Array;
  try {
    fp = await senderFingerprint32(senderAddress);
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

export function tryParseEmergencyBinaryV2(raw: Uint8Array, maxTotalBytes: number): EmergencyBinaryV2Parsed | null {
  if (raw.length < HEADER_LEN || raw[0] !== EMERGENCY_BINARY_VERSION) return null;
  if (raw.length > maxTotalBytes) return null;
  const nonce = (raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4];
  const fp = raw.subarray(5, 37);
  const ciphertext = raw.subarray(37);
  return {
    nonce: nonce >>> 0,
    fingerprintHex: uint8ToHex(new Uint8Array(fp)),
    ciphertext,
  };
}

export function binaryWireToLatin1(wire: Uint8Array): string {
  let s = '';
  for (let i = 0; i < wire.length; i++) s += String.fromCharCode(wire[i]!);
  return s;
}

export function latin1ToBinaryWire(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
