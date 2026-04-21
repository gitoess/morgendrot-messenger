import type { Message } from '@/frontend/lib/types'

/** Grobe Trennung Posteingang: Kette „verschlüsselt“ vs. Klartext (Pinnwand/Funk) — kein Backend-Tag. */
export type InboxWireFilter = 'all' | 'encrypted' | 'plaintext'

export function messageMatchesInboxWireFilter(m: Message, f: InboxWireFilter): boolean {
  if (f === 'all') return true
  const enc = m.encrypted === true
  if (f === 'encrypted') return enc
  return !enc
}
