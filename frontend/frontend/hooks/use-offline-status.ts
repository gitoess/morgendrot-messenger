'use client'

import { useMemo } from 'react'
import type { ApiStatus } from '@/frontend/lib/api'
import { getOfflineMailboxQueueCount, isOfflineMailboxQueueEnabled } from '@/frontend/lib/api/offline-queue'

const INBOX_CACHE_KEY_PREFIX = 'morgendrot.inbox.cache.v1:'

export type OfflineMode = 'online' | 'offline' | 'cache'

export type OfflineStatusSnapshot = {
  mode: OfflineMode
  lastSuccessfulSyncMinutes: number | null
  queuePending: number
  queueEnabled: boolean
  restrictedFeatures: string[]
}

function latestInboxCacheSavedAtMs(): number | null {
  if (typeof window === 'undefined') return null
  let latest = 0
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(INBOX_CACHE_KEY_PREFIX)) continue
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { savedAtMs?: unknown }
      const ms = Number(parsed.savedAtMs ?? 0)
      if (Number.isFinite(ms) && ms > latest) latest = ms
    }
  } catch {
    return null
  }
  return latest > 0 ? latest : null
}

export function useOfflineStatus(p: {
  apiSnapshot: (ApiStatus & { error?: string }) | null
  backendReachable: boolean | null
}): OfflineStatusSnapshot {
  const { apiSnapshot, backendReachable } = p

  return useMemo(() => {
    const now = Date.now()
    const savedFromStatus = Number(apiSnapshot?.cacheSavedAtMs ?? 0)
    const savedFromInbox = latestInboxCacheSavedAtMs() ?? 0
    const savedAt = Math.max(
      Number.isFinite(savedFromStatus) ? savedFromStatus : 0,
      Number.isFinite(savedFromInbox) ? savedFromInbox : 0
    )
    const lastSuccessfulSyncMinutes =
      savedAt > 0 && Number.isFinite(savedAt) && now >= savedAt ? Math.floor((now - savedAt) / 60_000) : null

    const queuePending = getOfflineMailboxQueueCount()
    const queueEnabled = isOfflineMailboxQueueEnabled()

    const mode: OfflineMode =
      backendReachable === false ? (savedAt > 0 ? 'cache' : 'offline') : apiSnapshot?.fromCache === true ? 'cache' : 'online'

    const restrictedFeatures: string[] = []
    if (mode !== 'online') {
      restrictedFeatures.push('IOTA Live-Sync')
      restrictedFeatures.push('Neue Inbox-Liveabfrage')
    }
    if (mode === 'offline') restrictedFeatures.push('Handoff-Apply ueber Basis')

    return {
      mode,
      lastSuccessfulSyncMinutes,
      queuePending,
      queueEnabled,
      restrictedFeatures,
    }
  }, [apiSnapshot?.cacheSavedAtMs, apiSnapshot?.fromCache, backendReachable])
}
