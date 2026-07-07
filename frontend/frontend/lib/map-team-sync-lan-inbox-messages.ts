'use client'

import type { TeamSyncLanInboxEntry } from '@/frontend/lib/api/team-sync-lan'
import {
  resolveTeamSyncWireBossAddress,
  resolveTeamSyncWireDedupKey,
} from '@/frontend/lib/team-sync-wire-dedup'
import type { Message } from '@/frontend/lib/types'

export function mapTeamSyncLanEntriesToMessages(
  entries: TeamSyncLanInboxEntry[],
  myAddress: string
): Message[] {
  const me = myAddress.trim().toLowerCase()
  return entries.map((e) => {
    const wire = e.wire.trim()
    const from = resolveTeamSyncWireBossAddress(wire)
    return {
      id: `team-sync-lan:${e.id}`,
      from,
      recipient: me,
      content: wire,
      timestamp: e.createdAt,
      encrypted: false,
      source: 'lan' as const,
      transports: ['lan'] as const,
      dedupKey: resolveTeamSyncWireDedupKey(wire),
    }
  })
}
