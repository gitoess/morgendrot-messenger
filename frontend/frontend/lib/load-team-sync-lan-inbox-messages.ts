'use client'

import { fetchTeamSyncLanInbox } from '@/frontend/lib/api/team-sync-lan'
import { getApiBase } from '@/frontend/lib/api/api-base'
import { isBossLanApiBase } from '@/frontend/lib/is-boss-lan-api-base'
import { mapTeamSyncLanEntriesToMessages } from '@/frontend/lib/map-team-sync-lan-inbox-messages'
import type { Message } from '@/frontend/lib/types'

const LS_LAN_SINCE = 'morgendrot.teamSyncLanInboxSinceMs'
const OVERLAP_MS = 60_000

export function readTeamSyncLanPollSinceMs(): number {
  if (typeof window === 'undefined') return 0
  try {
    const n = Number(window.localStorage.getItem(LS_LAN_SINCE) || '0')
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function bumpTeamSyncLanPollSinceMs(ts: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_LAN_SINCE, String(ts))
  } catch {
    /* ignore */
  }
}

export async function loadTeamSyncLanInboxMessages(myAddress: string): Promise<Message[]> {
  const addr = myAddress.trim()
  if (!addr) return []
  if (!isBossLanApiBase(getApiBase())) return []
  const sinceMs = Math.max(0, readTeamSyncLanPollSinceMs() - OVERLAP_MS)
  const r = await fetchTeamSyncLanInbox({ address: addr, sinceMs })
  if (!r.ok || !r.entries?.length) return []
  bumpTeamSyncLanPollSinceMs(Date.now())
  return mapTeamSyncLanEntriesToMessages(r.entries, addr)
}
