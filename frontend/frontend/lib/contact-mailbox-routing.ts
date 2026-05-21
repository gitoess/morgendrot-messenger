import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  type ContactMailboxSlotId,
  readContactMailboxSlots,
  resolveContactMailboxSlotObjectId,
} from '@/frontend/lib/contact-mailbox-slots'

export function resolveContactMailboxObjectId(
  directory: Record<string, ContactMeshEntryClient>,
  recipientAddress: string,
  slot?: ContactMailboxSlotId
): string | undefined {
  const key = recipientAddress.trim().toLowerCase()
  if (!key.startsWith('0x')) return undefined
  const entry = directory[key]
  if (slot) return resolveContactMailboxSlotObjectId(entry, slot)
  const slots = readContactMailboxSlots(entry)
  return slots.private ?? slots.team ?? slots.shared ?? slots.buffer
}

/** Telefonbuch: Wallet zu einer gespeicherten Mailbox-Object-ID (beliebiger Slot). */
export function findContactAddressByMailboxObjectId(
  directory: Record<string, ContactMeshEntryClient>,
  mailboxObjectId: string
): string | undefined {
  const want = mailboxObjectId.trim().toLowerCase()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(want)) return undefined
  for (const [key, entry] of Object.entries(directory)) {
    const slots = readContactMailboxSlots(entry)
    const hit = Object.values(slots).some((mb) => mb === want)
    if (!hit) continue
    const addr = key.trim().toLowerCase()
    if (/^0x[a-fA-F0-9]{64}$/i.test(addr)) return addr
  }
  return undefined
}
