/**
 * § H.23 Phase A1 — Session Keys+ (Envelope v2, Session-Key-Ableitung).
 * Wire/Send-Pfad nutzt v1 weiter; diese API ist für Migration und Tests.
 */
import { base64ToUint8, uint8ToBase64 } from './bytes-base64';

function getSubtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto fehlt: globalThis.crypto.subtle (Node: webcrypto polyfill).');
  return s;
}

function buf(u: Uint8Array): Parameters<SubtleCrypto['importKey']>[1] {
  return u as Parameters<SubtleCrypto['importKey']>[1];
}

/** Envelope-Header als AES-GCM AAD (§ MESSENGER-E2EE-ZIELARCHITEKTUR.md §4.2). */
export type MorgMsgEnvelopeV2 = {
  v: 2;
  cs: number;
  epoch: number;
  skid: string;
  msgId: string;
  ts: number;
};

/** Default keyEpoch für neue Session v2-Nachrichten (§ H.23). */
export const DEFAULT_SESSION_KEY_EPOCH = 1;
export const SESSION_CIPHER_SUITE_P256_AES_GCM = 1;

export function buildSessionKeyInfo(localAddress: string, remoteAddress: string, epoch: number): Uint8Array {
  const local = localAddress.trim().toLowerCase();
  const remote = remoteAddress.trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(local) || !/^0x[a-f0-9]{64}$/.test(remote)) {
    throw new Error('buildSessionKeyInfo: Adressen müssen 0x + 64 Hex sein.');
  }
  if (!Number.isInteger(epoch) || epoch < 0 || epoch > 0xffff_ffff) {
    throw new Error('buildSessionKeyInfo: epoch muss u32 sein.');
  }
  const [p0, p1] = local < remote ? [local, remote] : [remote, local];
  return new TextEncoder().encode(`morgendrot-session-v2:${p0}:${p1}:${epoch}`);
}

/** Session-Key pro Partnerpaar + keyEpoch (symmetrisch: sortiertes Adresspaar). */
export async function deriveSessionAesGcmKey(
  sharedSecret: Uint8Array,
  localAddress: string,
  remoteAddress: string,
  epoch: number
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey('raw', buf(sharedSecret), 'HKDF', false, ['deriveBits', 'deriveKey']);
  return await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(16),
      info: buildSessionKeyInfo(localAddress, remoteAddress, epoch),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/** Stabile JSON-Reihenfolge für AAD. */
export function serializeMorgMsgAad(envelope: MorgMsgEnvelopeV2): Uint8Array {
  if (envelope.v !== 2) throw new Error('serializeMorgMsgAad: nur v=2');
  const json = JSON.stringify({
    v: envelope.v,
    cs: envelope.cs,
    epoch: envelope.epoch,
    skid: envelope.skid,
    msgId: envelope.msgId,
    ts: envelope.ts,
  });
  return new TextEncoder().encode(json);
}

export async function encryptSessionMessage(
  aesKey: CryptoKey,
  plaintext: string,
  aad: Uint8Array
): Promise<{ iv: string; ciphertext: string }> {
  const subtle = getSubtle();
  const iv = new Uint8Array(12);
  globalThis.crypto!.getRandomValues(iv);
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad) },
    aesKey,
    new TextEncoder().encode(plaintext)
  );
  return {
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptSessionMessage(
  aesKey: CryptoKey,
  ivBase64: string,
  ciphertextBase64: string,
  aad: Uint8Array
): Promise<string> {
  const subtle = getSubtle();
  const iv = base64ToUint8(ivBase64);
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad) },
    aesKey,
    buf(base64ToUint8(ciphertextBase64))
  );
  return new TextDecoder().decode(decrypted);
}
