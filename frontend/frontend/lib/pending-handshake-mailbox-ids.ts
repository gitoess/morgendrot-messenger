/**
 * Client-Mailbox-IDs für Handshake-Scan (Private/Team lokal, nicht nur Server-MAILBOX_ID).
 */
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
import { readMyPrivateMailboxes } from '@/frontend/lib/my-private-mailbox-store'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'

function isMailboxId(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(id.trim())
}

/** Union aus lokal verwalteten Private-/Team-Mailboxes + aktive Send-Mailbox. */
export function readClientMailboxIdsForHandshakeScan(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const id = raw.trim()
    const k = id.toLowerCase()
    if (!isMailboxId(id) || seen.has(k)) return
    seen.add(k)
    out.push(id)
  }
  for (const m of readMyPrivateMailboxes()) push(m.objectId)
  for (const m of readMyTeamMailboxes()) push(m.objectId)
  push(readActiveSendMailboxObjectId())
  return out
}
