/**
 * Mesh v2: innerer AES-GCM-Blob + Emergency-Binary-Hülle (PRIVATE_APP).
 * Isomorph: nur morgendrot-crypto + emergency-binary-wire (shared).
 */
import { base64ToUint8, uint8ToBase64 } from './bytes-base64';
import { buildEmergencyBinaryV2, tryParseEmergencyBinaryV2 } from './emergency-binary-wire';
import { deriveAesGcmKey, deriveSharedSecret, decryptMessage, encryptMessage } from './morgendrot-crypto';

const MESH_V2_MAX_BYTES = 240;

export async function buildMeshPeerInnerBlob(
  message: string,
  peerPubRaw: Uint8Array,
  myPrivKey: CryptoKey
): Promise<Uint8Array> {
  const sharedSecret = await deriveSharedSecret(myPrivKey, peerPubRaw);
  const aesKey = await deriveAesGcmKey(sharedSecret);
  const encrypted = await encryptMessage(aesKey, message);
  const full = base64ToUint8(encrypted.ciphertext);
  const iv = base64ToUint8(encrypted.iv);
  const inner = new Uint8Array(12 + full.length);
  inner.set(iv, 0);
  inner.set(full, 12);
  return inner;
}

export async function decryptMeshPeerInnerBlob(
  inner: Uint8Array,
  senderPubRaw: Uint8Array,
  myPrivKey: CryptoKey
): Promise<string | null> {
  if (inner.length < 13) return null;
  const ivB64 = uint8ToBase64(inner.subarray(0, 12));
  const combinedB64 = uint8ToBase64(inner.subarray(12));
  try {
    const aesKey = await deriveAesGcmKey(await deriveSharedSecret(myPrivKey, senderPubRaw));
    return await decryptMessage(aesKey, ivB64, combinedB64);
  } catch {
    return null;
  }
}

export async function packMeshEmergencyV2Wire(
  myIotaAddress: string,
  meshNonce: number,
  inner: Uint8Array
): Promise<{ ok: true; wire: Uint8Array } | { ok: false; error: string }> {
  return buildEmergencyBinaryV2(myIotaAddress, meshNonce, inner, MESH_V2_MAX_BYTES);
}

export async function decryptMeshEmergencyV2Wire(
  wire: Uint8Array,
  senderPubRaw: Uint8Array,
  myPrivKey: CryptoKey
): Promise<string | null> {
  const parsed = tryParseEmergencyBinaryV2(wire, MESH_V2_MAX_BYTES);
  if (!parsed) return null;
  return decryptMeshPeerInnerBlob(parsed.ciphertext, senderPubRaw, myPrivKey);
}
