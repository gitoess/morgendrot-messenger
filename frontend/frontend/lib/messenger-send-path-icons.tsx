'use client'

/**
 * Gemeinsame Sendepfad-/Transport-Icons — Chat-Kopf und Posteingang gleich.
 */

import type { LucideIcon } from 'lucide-react'
import { Inbox, Link2, Radio, Send, Smartphone } from 'lucide-react'

export type MessengerTransportIconKey = 'internet' | 'mesh' | 'adhoc' | 'telegram' | 'iota'

const MAP: Record<MessengerTransportIconKey, { Icon: LucideIcon; label: string }> = {
  /** Sendepfad „Alle“ — kein spezielles Kanal-Icon in Zeilen. */
  internet: { Icon: Inbox, label: 'Alle' },
  mesh: { Icon: Radio, label: 'Funk' },
  adhoc: { Icon: Smartphone, label: 'Ad-hoc' },
  telegram: { Icon: Send, label: 'Telegram' },
  iota: { Icon: Link2, label: 'IOTA' },
}

export function messengerTransportMeta(key: MessengerTransportIconKey): {
  Icon: LucideIcon
  label: string
} {
  return MAP[key]
}

/**
 * Inbox-Zeile: nur konkrete Kanäle (Funk / Telegram / IOTA / Ad-hoc).
 * „Alle“/Internet ohne Mailbox → kein Icon (null).
 */
export function inboxTransportIconKey(
  t: string,
  source?: string | null
): MessengerTransportIconKey | null {
  if (t === 'mesh' || source === 'mesh') return 'mesh'
  if (t === 'telegram' || source === 'telegram') return 'telegram'
  if (t === 'adhoc') return 'adhoc'
  if (source === 'mailbox' || t === 'internet' || t === 'lan') return 'iota'
  return null
}
