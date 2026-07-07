'use client'

import {
  normalizeGroupMemberAddress,
  readMessengerGroups,
  upsertMessengerGroup,
  type MessengerGroupDefinition,
} from '@/frontend/lib/messenger-group-store'
import { updateBossProvisionRegistryEntry } from '@/frontend/lib/boss-provision-registry'

export function findMessengerGroupById(groupId: string): MessengerGroupDefinition | null {
  return readMessengerGroups().find((g) => g.id === groupId) ?? null
}

export function messengerGroupDisplayName(groupId: string | null | undefined): string {
  if (!groupId) return '—'
  return findMessengerGroupById(groupId)?.name ?? 'Unbekannt'
}

/** Helfer-Adresse zur lokalen Messenger-Gruppe hinzufügen (idempotent). */
export function addMemberToMessengerGroup(groupId: string, rawAddress: string): boolean {
  const group = findMessengerGroupById(groupId)
  const address = normalizeGroupMemberAddress(rawAddress)
  if (!group || !address) return false
  if (group.memberAddresses.some((a) => a.toLowerCase() === address)) return true
  upsertMessengerGroup({
    ...group,
    memberAddresses: [...group.memberAddresses, address],
  })
  return true
}

/** Registry-Eintrag ↔ Gruppe verknüpfen und Helfer in Mitgliederliste aufnehmen. */
export async function assignProvisionHelperMessengerGroup(opts: {
  entryId: string
  groupId: string | null
  helperAddress: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (opts.groupId) {
    const added = addMemberToMessengerGroup(opts.groupId, opts.helperAddress)
    if (!added) return { ok: false, error: 'Messenger-Gruppe nicht gefunden.' }
  }
  return updateBossProvisionRegistryEntry(opts.entryId, {
    messengerGroupId: opts.groupId,
  })
}
