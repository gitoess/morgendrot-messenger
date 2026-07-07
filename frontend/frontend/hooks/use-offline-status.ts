'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ApiStatus } from '@/frontend/lib/api'
import { getOfflineMailboxQueueCount, isOfflineMailboxQueueEnabled } from '@/frontend/lib/api/offline-queue'
import { isInboxCacheStorageKey } from '@/frontend/lib/inbox-cache-key'

export type OfflineMode = 'online' | 'offline' | 'cache'

export type OfflineStatusSnapshot = {
  mode: OfflineMode
  lastSuccessfulSyncMinutes: number | null
  queuePending: number
  queueEnabled: boolean
  localHandoffOnly: boolean
  restrictedFeatures: string[]
}

function latestInboxCacheSavedAtMs(): number | null {
  if (typeof window === 'undefined') return null
  let latest = 0
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !isInboxCacheStorageKey(key)) continue
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
  const [hydrated, setHydrated] = useState(false)
  const [prefsTick, setPrefsTick] = useState(0)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    const onPrefs = () => setPrefsTick((n) => n + 1)
    window.addEventListener('morgendrot.offlinePrefsChanged', onPrefs)
    return () => window.removeEventListener('morgendrot.offlinePrefsChanged', onPrefs)
  }, [])

  return useMemo(() => {
    const now = Date.now()
    const savedFromStatus = Number(apiSnapshot?.cacheSavedAtMs ?? 0)
    const savedFromInbox = hydrated ? (latestInboxCacheSavedAtMs() ?? 0) : 0
    const savedAt = Math.max(
      Number.isFinite(savedFromStatus) ? savedFromStatus : 0,
      Number.isFinite(savedFromInbox) ? savedFromInbox : 0
    )
    const lastSuccessfulSyncMinutes =
      savedAt > 0 && Number.isFinite(savedAt) && now >= savedAt ? Math.floor((now - savedAt) / 60_000) : null

    const queuePending = hydrated ? getOfflineMailboxQueueCount() : 0
    const queueEnabled = hydrated ? isOfflineMailboxQueueEnabled() : false
    const localHandoffOnly = apiSnapshot?.fromLocalHandoff === true

    const mode: OfflineMode =
      backendReachable === false ? (savedAt > 0 ? 'cache' : 'offline') : apiSnapshot?.fromCache === true ? 'cache' : 'online'

    const restrictedFeatures: string[] = []
    if (mode !== 'online') {
      restrictedFeatures.push('IOTA Live-Sync')
      restrictedFeatures.push('Neue Inbox-Liveabfrage')
    }
    if (mode === 'offline') restrictedFeatures.push('Handoff-Apply ueber Basis')
    if (localHandoffOnly) restrictedFeatures.push('Handoff nur lokal vorgemerkt (Basis-Apply offen)')

    return {
      mode,
      lastSuccessfulSyncMinutes,
      queuePending,
      queueEnabled,
      localHandoffOnly,
      restrictedFeatures,
    }
  }, [apiSnapshot?.cacheSavedAtMs, apiSnapshot?.fromCache, apiSnapshot?.fromLocalHandoff, backendReachable, hydrated, prefsTick])
}
