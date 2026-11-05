/**
 * Ziel-Mailbox für Send: Kontakt-Slot (gewählt) > Kontakt-Default > eigene aktive > Server-Shared.
 */
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { normalizeMailboxObjectIdInput } from '@/frontend/lib/composer-mailbox-object-id'
import {
  type ContactSendMailboxTarget,
  readContactSendMailboxTarget,
  resolveContactMailboxSlotObjectId,
} from '@/frontend/lib/contact-mailbox-slots'
import { resolveContactMailboxObjectId } from '@/frontend/lib/contact-mailbox-routing'
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
import { readCachedServerMailboxObjectId } from '@/frontend/lib/my-private-mailbox-store'

function isValidMb(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(id.trim())
}

export function resolveOutboundMailboxObjectId(
  directory: Record<string, ContactMeshEntryClient>,
  recipientAddress: string,
  targetOverride?: ContactSendMailboxTarget,
  explicitComposerMailboxObjectId?: string
): string | undefined {
  const explicit = normalizeMailboxObjectIdInput(explicitComposerMailboxObjectId ?? '')
  if (explicit) return explicit

  const to = recipientAddress.trim().toLowerCase()
  const entry = /^0x[a-f0-9]{64}$/.test(to) ? directory[to] : undefined

  const target =
    targetOverride ??
    (to.startsWith('0x') ? readContactSendMailboxTarget(to) : undefined) ??
    'event'

  if (target === 'event') return undefined

  if (target === 'shared' || target === 'private' || target === 'team' || target === 'buffer') {
    const fromSlot = resolveContactMailboxSlotObjectId(entry, target, to)
    if (fromSlot) return fromSlot
    if (target === 'shared') {
      const serverMb = readCachedServerMailboxObjectId().trim()
      if (isValidMb(serverMb)) return serverMb
    }
  }

  if (target === 'server') {
    const serverMb = readCachedServerMailboxObjectId().trim()
    if (isValidMb(serverMb)) return serverMb
    return undefined
  }

  if (target === 'own') {
    const activeMb = readActiveSendMailboxObjectId().trim()
    if (isValidMb(activeMb)) return activeMb
    const serverMb = readCachedServerMailboxObjectId().trim()
    if (isValidMb(serverMb)) return serverMb
    return undefined
  }

  const contactMb = resolveContactMailboxObjectId(directory, to)
  if (contactMb) return contactMb
  const activeMb = readActiveSendMailboxObjectId().trim()
  if (isValidMb(activeMb)) return activeMb
  const serverMb = readCachedServerMailboxObjectId().trim()
  if (isValidMb(serverMb)) return serverMb
  return undefined
}
