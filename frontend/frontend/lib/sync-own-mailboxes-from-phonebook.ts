/**
 * Composer „Speicher auf der Chain“ liest Kontakt-Slots (Telefonbuch „Ich“).
 * Meine Mailboxen / Kontakt-QR lesen lokale Besitz-Listen — hier angleichen.
 */

import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { readPersistentContactDirectory } from '@/frontend/lib/contact-directory-local-store'
import { resolveContactMailboxSlots } from '@/frontend/lib/contact-mailbox-slots'
import { rememberMyPrivateMailbox } from '@/frontend/lib/my-private-mailbox-store'
import { rememberMyTeamMailbox } from '@/frontend/lib/my-team-mailbox-store'

export function syncOwnMailboxesFromPhonebook(
  myAddress: string,
  directory?: Record<string, ContactMeshEntryClient>
): {
  privateAdded: boolean
  teamAdded: boolean
} {
  const addr = myAddress.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(addr)) return { privateAdded: false, teamAdded: false }
  const dir = directory && Object.keys(directory).length > 0 ? directory : readPersistentContactDirectory()
  const entry = dir[addr]
  const slots = resolveContactMailboxSlots(addr, entry)
  const privateAdded = slots.private
    ? rememberMyPrivateMailbox({
        objectId: slots.private,
        label: 'Private (Telefonbuch)',
        createdAtMs: Date.now(),
      })
    : false
  const teamAdded = slots.team
    ? rememberMyTeamMailbox({
        objectId: slots.team,
        label: 'Team (Telefonbuch)',
        joinedAtMs: Date.now(),
      })
    : false
  return { privateAdded, teamAdded }
}
