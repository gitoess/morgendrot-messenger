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
