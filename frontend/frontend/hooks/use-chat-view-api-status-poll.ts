'use client'

/**
 * GET /api/status regelmäßig + Mirror-Drain im gleichen Tick; manuelles Refresh für UI.
 * Ergänzungen: basisUnreachable (Offline-/Funk-Hinweise in der Inbox), packageIdMismatch
 * (expliziter Posteingangs-Filter ≠ apiStatus.packageId).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { fetchStatus, type ApiStatus, type ApiStatusFetchOk } from '@/frontend/lib/api'
import { shouldShowPackageIdMismatchBanner } from '@/frontend/lib/package-id-compare'
import type { StatusPollClockHint } from '@/frontend/lib/device-time-trust'
import {
  hadRecentPlausibleServerTimeFromPoll,
  inferDeviceTimeTrust,
  shouldWarnUntrustedDeviceTime,
} from '@/frontend/lib/device-time-trust'
import { apiStatusPollSignature } from '@/frontend/lib/api-status-signature'

export type UseChatViewApiStatusPollParams = {
  runMirrorDrain: () => Promise<void>
  /** § H.3g Paket 7 (Vorbereitung): fehlgeschlagene `/send`-Versuche nachziehen. */
  runOfflineMailboxDrain?: () => Promise<void>
  /** Standard 12 s */
  pollIntervalMs?: number
  /**
   * Posteingangs-Feld „Package-ID“ (getrimmt). Leer = Backend-Default → kein Mismatch-Banner
   * (siehe `shouldShowPackageIdMismatchBanner`).
   */
  localPackageId: string
  /**
   * Einmaliger Versuch: **Geolocation** nur für **GPS-Zeit-Vertrauen** (`position.timestamp`, § H.6c).
   * Browser zeigt ggf. Nutzerdialog; bei Verweigerung bleibt der Pfad ohne GPS.
   */
  probeGeolocationForDeviceTime?: boolean
}

export function useChatViewApiStatusPoll(p: UseChatViewApiStatusPollParams) {
  const {
    runMirrorDrain,
    runOfflineMailboxDrain,
    pollIntervalMs = 12000,
    localPackageId,
    probeGeolocationForDeviceTime = true,
  } = p
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null)
  /** Letzter erfolgreicher Status-Poll (HTTP `Date`, § H.6c). */
  const [pollClockHint, setPollClockHint] = useState<StatusPollClockHint | null>(null)
  /** `GeolocationPosition.timestamp` plausibel (Satelliten-/Hybridzeit), § H.6c. */
  const [hasTrustedGpsUtcFix, setHasTrustedGpsUtcFix] = useState(false)
  /** GET /api/status fehlgeschlagen (Netzwerk, Backend aus). */
  const [basisUnreachable, setBasisUnreachable] = useState(false)
  /** Einmal Toast, wenn die Basis nach Ausfall wieder erreichbar ist. */
  const hadBasisUnreachable = useRef(false)
  const gpsProbeStartedRef = useRef(false)

  useEffect(() => {
    if (!probeGeolocationForDeviceTime) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    if (gpsProbeStartedRef.current) return
    gpsProbeStartedRef.current = true
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ts = pos.timestamp
        if (Number.isFinite(ts) && ts > 1_600_000_000_000) setHasTrustedGpsUtcFix(true)
      },
      () => {},
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 0 }
    )
  }, [probeGeolocationForDeviceTime])

  useEffect(() => {
    if (basisUnreachable) {
      hadBasisUnreachable.current = true
      return
    }
    if (hadBasisUnreachable.current) {
      toast.success('Basis wieder erreichbar')
      hadBasisUnreachable.current = false
    }
  }, [basisUnreachable])

  const applyStatusOk = useCallback((s: ApiStatusFetchOk) => {
    const { pollClockHint: hint, ...rest } = s
    setPollClockHint(hint)
    setApiStatus(rest)
  }, [])

  const refreshApiStatus = useCallback(async () => {
    const s = await fetchStatus()
    if (!('pollClockHint' in s)) {
      setBasisUnreachable(true)
      setApiStatus(null)
      setPollClockHint(null)
      return
    }
    setBasisUnreachable(false)
    applyStatusOk(s)
  }, [applyStatusOk])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const s = await fetchStatus()
      if (!alive) return
      if (!('pollClockHint' in s)) {
        setBasisUnreachable(true)
        setApiStatus(null)
        setPollClockHint(null)
        return
      }
      setBasisUnreachable(false)
      applyStatusOk(s)
      await runMirrorDrain()
      await runOfflineMailboxDrain?.()
    }
    void tick()
    const id = setInterval(() => void tick(), pollIntervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [runMirrorDrain, runOfflineMailboxDrain, pollIntervalMs, applyStatusOk])

  /** Jeder Render: `Date.now()` gegen `okAtMs` — kein `useMemo`, sonst veraltet die Warnung nach 15 min ohne Re-Render. */
  const navOnline = typeof navigator !== 'undefined' && navigator.onLine
  const hadServerTime = hadRecentPlausibleServerTimeFromPoll(pollClockHint, Date.now())
  const deviceTimeTrustWarn = shouldWarnUntrustedDeviceTime(
    inferDeviceTimeTrust({
      navigatorOnline: navOnline,
      hadRecentPlausibleServerOrChainTime: hadServerTime,
      hasTrustedGpsUtcFix,
    })
  )

  const packageIdMismatch = useMemo(
    () => shouldShowPackageIdMismatchBanner(localPackageId, apiStatus?.packageId, basisUnreachable),
    [localPackageId, apiStatus?.packageId, basisUnreachable]
  )

  return { apiStatus, refreshApiStatus, basisUnreachable, packageIdMismatch, deviceTimeTrustWarn }
}
