/**
 * ECDH P-256 + AES-GCM – nur Web Crypto (globalThis.crypto.subtle), kein node:crypto.
 * Vor Import in Node: globalThis.crypto setzen (siehe start-with-secrets / run-tests).
 */
import { base64ToUint8, uint8ToBase64 } from './bytes-base64';

function getSubtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto fehlt: globalThis.crypto.subtle (Node: webcrypto polyfill).');
  return s;
}

/** TS ohne DOM-lib: `Uint8Array` vs. `importKey`-Erwartung angleichen. */
function buf(u: Uint8Array): Parameters<SubtleCrypto['importKey']>[1] {
  return u as Parameters<SubtleCrypto['importKey']>[1];
}

export const CURVE = 'P-256';

export type KeyPair = { privateKey: CryptoKey; pubRaw: Uint8Array };

export async function generateKeyPair(extractable = true): Promise<KeyPair> {
  const subtle = getSubtle();
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    extractable,
    ['deriveBits', 'deriveKey']
  );
  const pubRaw = await subtle.exportKey('raw', keyPair.publicKey);
  return { privateKey: keyPair.privateKey, pubRaw: new Uint8Array(pubRaw) };
}

export async function deriveSharedSecret(privateKey: CryptoKey, peerPubRaw: Uint8Array): Promise<Uint8Array> {
  const subtle = getSubtle();
  const peerPubKey = await subtle.importKey(
    'raw',
    buf(peerPubRaw),
    { name: 'ECDH', namedCurve: CURVE },
    false,
    []
  );
  const sharedBits = await subtle.deriveBits({ name: 'ECDH', public: peerPubKey }, privateKey, 256);
  return new Uint8Array(sharedBits);
}

export async function deriveAesGcmKey(sharedSecret: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey('raw', buf(sharedSecret), 'HKDF', false, ['deriveBits', 'deriveKey']);
  return await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(16),
      info: new TextEncoder().encode('morgendrot-aes-gcm'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(aesKey: CryptoKey, message: string): Promise<{ iv: string; ciphertext: string }> {
  const subtle = getSubtle();
  const iv = new Uint8Array(12);
  globalThis.crypto!.getRandomValues(iv);
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: buf(iv) },
    aesKey,
    new TextEncoder().encode(message)
  );
  return {
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptMessage(aesKey: CryptoKey, ivBase64: string, ciphertextBase64: string): Promise<string> {
  const subtle = getSubtle();
  const iv = base64ToUint8(ivBase64);
  const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, aesKey, buf(base64ToUint8(ciphertextBase64)));
  return new TextDecoder().decode(decrypted);
}
