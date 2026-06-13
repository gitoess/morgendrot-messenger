'use client'

import { parseMailboxOutNonceMarker } from '@morgendrot/core'
import { base64ToUint8 } from '@morgendrot/shared/bytes-base64'
import { deriveAesGcmKey, deriveSharedSecret, encryptMessage } from '@morgendrot/shared/morgendrot-crypto'
import type { DirectChatEcdhMaterial } from '@/frontend/lib/direct-chat-ecdh-session'
import { prependMailboxOutNonceMarker } from '@/frontend/lib/api/offline-queue'
import type { EncryptedMailboxBatchItem } from '@morgendrot/core/iota'

export async function encryptForensicBatchWireToMailboxItem(
  wireUtf8: string,
  nonce: bigint,
  material: DirectChatEcdhMaterial
): Promise<EncryptedMailboxBatchItem | { error: string }> {
  const wireWithNonce = prependMailboxOutNonceMarker(wireUtf8, nonce)
  const parsed = parseMailboxOutNonceMarker(wireWithNonce)
  const bodyForE2ee = parsed?.rest ?? wireWithNonce
  const msgUtf8 = new TextEncoder().encode(bodyForE2ee).length
  if (msgUtf8 > 16_000) {
    return { error: `Forensic-Wire zu lang für Verschlüsselung (${msgUtf8} B).` }
  }
  try {
    const sharedSecret = await deriveSharedSecret(material.ecdhPrivateKey, material.peerPubRaw)
    const aesKey = await deriveAesGcmKey(sharedSecret)
    const encrypted = await encryptMessage(aesKey, bodyForE2ee)
    const full = base64ToUint8(encrypted.ciphertext)
    return {
      ciphertext: new Uint8Array(full.subarray(0, -16)),
      iv: base64ToUint8(encrypted.iv),
      tag: new Uint8Array(full.subarray(-16)),
      nonce: parsed?.nonce ?? nonce,
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
