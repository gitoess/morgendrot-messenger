'use client'

import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

export type ComposerEncryptionHintInput = {
  forcedTransport: ForcedTransport
  encrypted: boolean
}

/**
 * § H.3o.6 (3): Abgrenzung Meshtastic-Kanal-PSK vs. Online-Schloss (IOTA/ECDH).
 */
export function getComposerEncryptionContextHint(input: ComposerEncryptionHintInput): string | null {
  const { forcedTransport, encrypted } = input

  if (forcedTransport === 'mesh') {
    if (encrypted) {
      return 'Funk + Schloss: Online-Verschlüsselung läuft nicht über Meshtastic — Schloss aus oder Sendepfad „online“.'
    }
    return null
  }

  if (forcedTransport === 'internet') {
    if (encrypted) {
      return 'Online · Session Keys+ (Envelope v2): Schutz auf der Mailbox — Rotation unter Einstellungen (§ H.23).'
    }
    return 'Online · Klartext: unverschlüsselt auf Mailbox/IOTA — Schloss aus.'
  }

  if (forcedTransport === 'adhoc') {
    if (encrypted) return null
    return 'Ad-hoc · Klartext — kein Meshtastic-Kanal-PSK.'
  }

  return null
}
