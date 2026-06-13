/**
 * § H.33e — Forensic-Wire → verschlüsseltes Mailbox-Item (Boss-API, Core-Crypto).
 */
import { encryptForensicWireToMailboxItem } from '@morgendrot/core/forensic-batch'
import type { EncryptedMailboxBatchItem } from '@morgendrot/core/iota'
import type { ForensicEcdhMaterial } from './forensic-batch-ecdh.js'

export async function encryptForensicBatchWireToMailboxItemServer(
  wireUtf8: string,
  nonce: bigint,
  material: ForensicEcdhMaterial
): Promise<EncryptedMailboxBatchItem | { error: string }> {
  return encryptForensicWireToMailboxItem(wireUtf8, nonce, material)
}
