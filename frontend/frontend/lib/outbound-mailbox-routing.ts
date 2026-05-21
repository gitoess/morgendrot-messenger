/**
 * Ziel-Mailbox für Send: Kontakt-private Mailbox > eigene aktive private > Server-Shared (.env).
 */
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { resolveContactMailboxObjectId } from '@/frontend/lib/contact-mailbox-routing'
import {
  readActiveMailboxSelection,
  readCachedServerMailboxObjectId,
} from '@/frontend/lib/my-private-mailbox-store'

export function resolveOutboundMailboxObjectId(
  directory: Record<string, ContactMeshEntryClient>,
  recipientAddress: string
): string | undefined {
  const contactMb = resolveContactMailboxObjectId(directory, recipientAddress.trim())
  if (contactMb) return contactMb
  const sel = readActiveMailboxSelection()
  if (sel.kind === 'private') return sel.objectId
  const serverMb = readCachedServerMailboxObjectId().trim()
  if (/^0x[a-fA-F0-9]{64}$/i.test(serverMb)) return serverMb
  return undefined
}
