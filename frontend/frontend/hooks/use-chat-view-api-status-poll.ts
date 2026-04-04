'use client'

/**
 * GET /api/status regelmäßig + Mirror-Drain im gleichen Tick; manuelles Refresh für UI.
 * Ergänzungen: basisUnreachable (Offline-/Funk-Hinweise in der Inbox), packageIdMismatch
 * (expliziter Posteingangs-Filter ≠ apiStatus.packageId).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchStatus, type ApiStatus } from '@/frontend/lib/api'
import { shouldShowPackageIdMismatchBanner } from '@/frontend/lib/package-id-compare'

export type UseChatViewApiStatusPollParams = {
  runMirrorDrain: () => Promise<void>
  /** Standard 12 s */
  pollIntervalMs?: number
  /**
   * Posteingangs-Feld „Package-ID“ (getrimmt). Leer = Backend-Default → kein Mismatch-Banner
   * (siehe `shouldShowPackageIdMismatchBanner`).
   */
  localPackageId: string
}

export function useChatViewApiStatusPoll(p: UseChatViewApiStatusPollParams) {
  const { runMirrorDrain, pollIntervalMs = 12000, localPackageId } = p
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null)
  /** GET /api/status fehlgeschlagen (Netzwerk, Backend aus). */
  const [basisUnreachable, setBasisUnreachable] = useState(false)

  const refreshApiStatus = useCallback(async () => {
    const s = await fetchStatus()
    if (s.error) {
      setBasisUnreachable(true)
      setApiStatus(null)
      return
    }
    setBasisUnreachable(false)
    setApiStatus(s)
  }, [])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      const s = await fetchStatus()
      if (!alive) return
      if (s.error) {
        setBasisUnreachable(true)
        setApiStatus(null)
        return
      }
      setBasisUnreachable(false)
      setApiStatus(s)
      await runMirrorDrain()
    }
    void tick()
    const id = setInterval(() => void tick(), pollIntervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [runMirrorDrain, pollIntervalMs])

  const packageIdMismatch = useMemo(
    () => shouldShowPackageIdMismatchBanner(localPackageId, apiStatus?.packageId, basisUnreachable),
    [localPackageId, apiStatus?.packageId, basisUnreachable]
  )

  return { apiStatus, refreshApiStatus, basisUnreachable, packageIdMismatch }
}
