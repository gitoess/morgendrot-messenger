import { parseMailboxOutNonceMarker, prependMailboxOutNonceMarker } from '../queue/offline-mailbox'
import type { EncryptedMailboxBatchItem } from '../iota/mailbox-encrypted-batch-txb'
import { base64ToUint8 } from '@morgendrot/shared/bytes-base64'
import { deriveAesGcmKey, deriveSharedSecret, encryptMessage } from '@morgendrot/shared/morgendrot-crypto'

export type ForensicWireEcdhMaterial = {
  ecdhPrivateKey: CryptoKey
  peerPubRaw: Uint8Array
}

const MAX_WIRE_UTF8_BYTES = 16_000

/** Forensic-Wire → verschlüsseltes Mailbox-Item (Browser + Boss, gleiche Crypto). */
export async function encryptForensicWireToMailboxItem(
  wireUtf8: string,
  nonce: bigint,
  material: ForensicWireEcdhMaterial
): Promise<EncryptedMailboxBatchItem | { error: string }> {
  const wireWithNonce = prependMailboxOutNonceMarker(wireUtf8, nonce)
  const parsed = parseMailboxOutNonceMarker(wireWithNonce)
  const bodyForE2ee = parsed?.rest ?? wireWithNonce
  const msgUtf8 = new TextEncoder().encode(bodyForE2ee).length
  if (msgUtf8 > MAX_WIRE_UTF8_BYTES) {
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
