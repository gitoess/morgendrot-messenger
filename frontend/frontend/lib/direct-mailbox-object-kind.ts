/**
 * Shared `Mailbox` (Server, Team) vs. `PrivateMailbox` — falsche Move-Funktion → Explorer
 * „Invalid command argument at 0. The type of the value does not match the expected type“.
 */
import { readMyPrivateMailboxes } from '@/frontend/lib/my-private-mailbox-store'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

function norm(id: string): string {
  return id.trim().toLowerCase()
}

export function isKnownPrivateMailboxObjectId(objectId: string): boolean {
  const n = norm(objectId)
  if (!HEX64.test(n)) return false
  return readMyPrivateMailboxes().some((p) => norm(p.objectId) === n)
}

export function isKnownTeamMailboxObjectId(objectId: string): boolean {
  const n = norm(objectId)
  if (!HEX64.test(n)) return false
  return readMyTeamMailboxes().some((t) => norm(t.objectId) === n)
}

/** Welche Move-Mailbox-Funktion für Direkt-PTB (nur PrivateMailbox → *_private). */
export function resolveDirectMailboxUsePrivateMoveCall(opts: {
  mailboxObjectId?: string
  serverMailboxId: string
}): { mailboxObjectId: string; privateMailbox: boolean } {
  const server = opts.serverMailboxId.trim()
  const override = (opts.mailboxObjectId ?? '').trim()
  if (!HEX64.test(server)) {
    throw new Error('Server-Mailbox-ID fehlt im Ketten-Snapshot.')
  }
  if (!HEX64.test(override) || norm(override) === norm(server)) {
    return { mailboxObjectId: server, privateMailbox: false }
  }
  if (isKnownPrivateMailboxObjectId(override)) {
    return { mailboxObjectId: override, privateMailbox: true }
  }
  /** Team-Postfach = `Mailbox` (shared), nicht `PrivateMailbox`. */
  return { mailboxObjectId: override, privateMailbox: false }
}
