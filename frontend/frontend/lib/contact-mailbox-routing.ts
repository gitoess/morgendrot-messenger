import type { ContactMeshEntryClient } from '@/frontend/lib/api'

export function resolveContactMailboxObjectId(
  directory: Record<string, ContactMeshEntryClient>,
  recipientAddress: string
): string | undefined {
  const key = recipientAddress.trim().toLowerCase()
  if (!key.startsWith('0x')) return undefined
  const mb = directory[key]?.mailboxObjectId?.trim()
  if (!mb || !/^0x[a-fA-F0-9]{64}$/i.test(mb)) return undefined
  return mb
}

/** Telefonbuch: Wallet-Adresse zu einer gespeicherten Private-Mailbox-Object-ID. */
export function findContactAddressByMailboxObjectId(
  directory: Record<string, ContactMeshEntryClient>,
  mailboxObjectId: string
): string | undefined {
  const want = mailboxObjectId.trim().toLowerCase()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(want)) return undefined
  for (const [key, entry] of Object.entries(directory)) {
    const mb = entry.mailboxObjectId?.trim().toLowerCase()
    if (mb !== want) continue
    const addr = key.trim().toLowerCase()
    if (/^0x[a-fA-F0-9]{64}$/i.test(addr)) return addr
  }
  return undefined
}
