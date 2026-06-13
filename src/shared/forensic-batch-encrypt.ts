/**
 * § H.33e — Forensic-Wire → verschlüsseltes Mailbox-Item (Boss-API, gleiche Crypto wie PWA).
 */
import { parseMailboxOutNonceMarker, prependMailboxOutNonceMarker } from '@morgendrot/core/queue/offline-mailbox'
import type { EncryptedMailboxBatchItem } from '@morgendrot/core/iota'
import { deriveAesGcmKey, deriveSharedSecret, encryptMessage } from '../crypto-layer.js'
import { base64ToUint8 } from '../shared/bytes-base64.js'
import type { ForensicEcdhMaterial } from './forensic-batch-ecdh.js'

export async function encryptForensicBatchWireToMailboxItemServer(
    wireUtf8: string,
    nonce: bigint,
    material: ForensicEcdhMaterial
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
