'use client'

/**
 * Gemeinsame Sendepfad-/Transport-Icons — Chat-Kopf und Posteingang gleich.
 */

import type { LucideIcon } from 'lucide-react'
import { Globe2, Link2, Radio, Send, Smartphone } from 'lucide-react'

export type MessengerTransportIconKey = 'internet' | 'mesh' | 'adhoc' | 'telegram' | 'iota'

const MAP: Record<MessengerTransportIconKey, { Icon: LucideIcon; label: string }> = {
  internet: { Icon: Globe2, label: 'Online' },
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

/** Inbox-Zeile: source/transport → Icon-Key (IOTA-Fokus nur im Sendepfad). */
export function inboxTransportIconKey(
  t: string
): Exclude<MessengerTransportIconKey, 'iota'> {
  if (t === 'mesh') return 'mesh'
  if (t === 'telegram') return 'telegram'
  if (t === 'adhoc') return 'adhoc'
  return 'internet'
}
