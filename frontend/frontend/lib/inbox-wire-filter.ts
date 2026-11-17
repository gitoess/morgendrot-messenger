import type { Message } from '@/frontend/lib/types'
import { isNftGateMessageWire } from '@/frontend/lib/nft-gate-dek-capsule'
import { isPassphraseMessageWire } from '@/frontend/lib/passphrase-message-crypto'

/** Grobe Trennung Posteingang: geschützter Inhalt vs. Klartext — kein Backend-Tag. */
export type InboxWireFilter = 'all' | 'encrypted' | 'plaintext'

/**
 * ECDH-Flag **oder** Passphrase-/NFT-Gate-Wire (Transport oft „Klartext“, Inhalt ist Cipher).
 * Sonst versteckt „Nur verschlüsselt“ PWMSG/NFTGATE fälschlich.
 */
export function messageLooksCipherProtected(m: Message): boolean {
  if (m.encrypted === true) return true
  const c = `${m.content ?? ''}`
  return isPassphraseMessageWire(c) || isNftGateMessageWire(c)
}

export function messageMatchesInboxWireFilter(m: Message, f: InboxWireFilter): boolean {
  if (f === 'all') return true
  const enc = messageLooksCipherProtected(m)
  if (f === 'encrypted') return enc
  return !enc
}
