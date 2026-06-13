'use client'

import { encryptForensicWireToMailboxItem } from '@morgendrot/core/forensic-batch'
import type { DirectChatEcdhMaterial } from '@/frontend/lib/direct-chat-ecdh-session'
import type { EncryptedMailboxBatchItem } from '@morgendrot/core/iota'

export async function encryptForensicBatchWireToMailboxItem(
  wireUtf8: string,
  nonce: bigint,
  material: DirectChatEcdhMaterial
): Promise<EncryptedMailboxBatchItem | { error: string }> {
  return encryptForensicWireToMailboxItem(wireUtf8, nonce, material)
}
