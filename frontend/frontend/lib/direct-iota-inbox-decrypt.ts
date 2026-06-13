'use client'

import { uint8ToBase64 } from '@morgendrot/shared/bytes-base64'
import { deriveAesGcmKey, deriveSharedSecret, decryptMessage } from '@morgendrot/shared/morgendrot-crypto'
import {
  getDirectChatEcdhMaterialForRecipient,
  getDirectChatEcdhPrivateKey,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { ensureDirectChatPeerPubForRecipient } from '@/frontend/lib/direct-iota-encrypted-send-prep'

export type EncryptedInboxPayload = {
  iv: Uint8Array
  ciphertext: Uint8Array
  tag: Uint8Array
}

export async function decryptDirectInboxEncryptedPayload(
  peerAddr: string,
  payload: EncryptedInboxPayload
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
  if (!mat && getDirectChatEcdhPrivateKey()) {
    await ensureDirectChatPeerPubForRecipient(peerAddr)
    mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
  }
  if (!mat) {
    return {
      ok: false,
      error: `[Verschlüsselt] Kein Chat-ECDH für ${String(peerAddr).slice(0, 14)}… — Peer-Pub in den Puls-Einstellungen setzen.`,
    }
  }
  try {
    const sharedSecret = await deriveSharedSecret(mat.ecdhPrivateKey, mat.peerPubRaw)
    const aesKey = await deriveAesGcmKey(sharedSecret)
    const ivB64 = uint8ToBase64(payload.iv)
    const combined = new Uint8Array([...payload.ciphertext, ...payload.tag])
    const text = await decryptMessage(aesKey, ivB64, uint8ToBase64(combined))
    return { ok: true, text }
  } catch {
    return { ok: false, error: '[Verschlüsselt] Entschlüsselung fehlgeschlagen.' }
  }
}
