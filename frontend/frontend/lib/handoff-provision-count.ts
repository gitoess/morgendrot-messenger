'use client'

import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  countBossProvisionRegistryByStatus,
  getBossProvisionRegistryEntries,
  isBossProvisionRegistryUnlocked,
} from '@/frontend/lib/boss-provision-registry'
import { listTeamRosterWalletContacts } from '@/frontend/lib/team-roster-wire'

/** Anzahl provisionierter Helfer (Registry bevorzugt, sonst Team-Telefonbuch). */
export function countBossProvisionedHelpers(
  apiSnapshot?: ApiStatus | null,
  contactDirectory?: Record<string, ContactMeshEntryClient>
): number {
  if (isBossProvisionRegistryUnlocked()) {
    return countBossProvisionRegistryByStatus(getBossProvisionRegistryEntries()).total
  }
  const boss = (apiSnapshot?.myAddressFull || apiSnapshot?.myAddress || '').trim()
  if (!boss) return 0
  return listTeamRosterWalletContacts(contactDirectory ?? {}, boss).length
}

export function bossProvisionedHelpersLabel(count: number): string {
  if (count <= 0) return 'Noch keine Helfer provisioniert'
  if (count === 1) return '1 Helfer provisioniert'
  return `${count} Helfer provisioniert`
}
