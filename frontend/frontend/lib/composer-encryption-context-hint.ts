'use client'

import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

export type ComposerEncryptionHintInput = {
  forcedTransport: ForcedTransport
  encrypted: boolean
}

/** UI zeigt Verschlüsselung über Sendepfad/Schloss — kein Zusatz-Erklärtext. */
export function getComposerEncryptionContextHint(_input: ComposerEncryptionHintInput): string | null {
  return null
}
