'use client'

import { useEffect } from 'react'
import type { ApiStatus } from '@/frontend/lib/api'
import { isBossApiLikelyOnline } from '@/frontend/lib/api/boss-api-status'
import { fetchForensicBatchRegistryFromBossApi } from '@/frontend/lib/api/forensic-batch-api'
import { mergeForensicBatchRegistryImport } from '@/frontend/lib/forensic-batch-registry'
import { FORENSIC_BATCH_CHANGED } from '@/frontend/lib/forensic-batch-config'

/** Einmaliger Boss→PWA Registry-Sync (Panel + Auto-Hook teilen sich das). */
export function useForensicBatchRegistrySync(apiStatus?: ApiStatus | null): void {
  useEffect(() => {
    if (!isBossApiLikelyOnline(apiStatus)) return
    let cancelled = false
    void fetchForensicBatchRegistryFromBossApi().then((sync) => {
      if (cancelled || !sync.ok || !sync.entries.length) return
      mergeForensicBatchRegistryImport(sync.entries, 'merge')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FORENSIC_BATCH_CHANGED))
      }
    })
    return () => {
      cancelled = true
    }
  }, [apiStatus?.backendRunning, apiStatus?.backendOnline, apiStatus?.myAddress])
}
