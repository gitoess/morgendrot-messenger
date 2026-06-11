/**
 * Zusätzliche Mailbox-IDs für Posteingang-Union (Team-Postfächer ≠ Server-MAILBOX_ID).
 */
import { resolveGroupTeamBroadcastMailboxIds } from '@/frontend/lib/group-team-broadcast'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

/** Alle lokal bekannten Team-Mailboxen (Gruppen + „Meine Team-Postfächer“). */
export function collectInboxAlsoMailboxIds(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const id = raw.trim()
    if (!HEX64.test(id)) return
    const k = id.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(id)
  }
  for (const id of resolveGroupTeamBroadcastMailboxIds(readMessengerGroups())) push(id)
  for (const t of readMyTeamMailboxes()) push(t.objectId)
  return out
}
