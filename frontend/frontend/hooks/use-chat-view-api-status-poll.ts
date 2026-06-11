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
import {
  applyDirectMailboxChainSnapshotFromNetworkIds,
  syncDirectMailboxFlagsFromApiStatus,
} from '@/frontend/lib/direct-iota-chain-context'
import { persistConnectedPeersSnapshot } from '@/frontend/lib/connected-peers-snapshot'
import { cacheServerMailboxObjectId } from '@/frontend/lib/my-private-mailbox-store'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'

export type UseChatViewApiStatusPollParams = {
  runMirrorDrain: () => Promise<void>
  /** § H.3g Paket 7 (Vorbereitung): fehlgeschlagene `/send`-Versuche nachziehen. */
  runOfflineMailboxDrain?: () => Promise<void>
  /** Posteingang: nur neue Zeilen (kein Full-Reset). */
  pollInbox?: () => void | Promise<void>
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
  /** Sofort-Aktionen bei Reconnect (offline/cache -> online). */
  onReconnectNow?: () => void | Promise<void>
}

export function useChatViewApiStatusPoll(p: UseChatViewApiStatusPollParams) {
  const {
    runMirrorDrain,
    runOfflineMailboxDrain,
    pollInbox,
    pollIntervalMs = 12000,
    localPackageId,
    probeGeolocationForDeviceTime = true,
    onReconnectNow,
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
    void (async () => {
      try {
        const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
        if (perm?.state === 'denied') return
      } catch {
        /* Permissions API optional */
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ts = pos.timestamp
          if (Number.isFinite(ts) && ts > 1_600_000_000_000) setHasTrustedGpsUtcFix(true)
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }
      )
    })()
  }, [probeGeolocationForDeviceTime])

  useEffect(() => {
    if (basisUnreachable) {
      hadBasisUnreachable.current = true
      return
    }
    if (hadBasisUnreachable.current) {
      toast.success('Basis wieder erreichbar')
      if (readLocalHandoffAppliedSnapshot()) {
        toast.info(
          'Handoff nur lokal vorgemerkt — unter Einstellungen → Handoff-Import jetzt auf die Basis anwenden.'
        )
      }
      void onReconnectNow?.()
      hadBasisUnreachable.current = false
    }
  }, [basisUnreachable, onReconnectNow])

  const applyStatusOk = useCallback((s: ApiStatusFetchOk) => {
    const { pollClockHint: hint, ...rest } = s
    setPollClockHint(hint)
    setApiStatus(rest)
    syncDirectMailboxFlagsFromApiStatus(rest)
    const mb = (rest.mailboxId || '').trim()
    if (mb) cacheServerMailboxObjectId(mb)
    const pkg = (rest.packageId || '').trim()
    const addr = (rest.myAddressFull || rest.myAddress || '').trim()
    if (mb && pkg && addr) {
      applyDirectMailboxChainSnapshotFromNetworkIds({ packageId: pkg, mailboxId: mb, myAddress: addr })
    }
    const conn = rest.connectedAddresses
    if (Array.isArray(conn) && conn.length > 0) {
      persistConnectedPeersSnapshot(conn)
    }
  }, [])

  const refreshApiStatus = useCallback(async () => {
    const s = await fetchStatus()
    if (!('pollClockHint' in s)) {
      setBasisUnreachable(true)
      setApiStatus(null)
      setPollClockHint(null)
      return
    }
    setBasisUnreachable(s.backendOnline === false)
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
      setBasisUnreachable(s.backendOnline === false)
      applyStatusOk(s)
      if (s.backendOnline !== false) {
        await runMirrorDrain()
        await runOfflineMailboxDrain?.()
      }
    }
    void tick()
    const id = setInterval(() => void tick(), pollIntervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [runMirrorDrain, runOfflineMailboxDrain, pollIntervalMs, applyStatusOk])

  /** Posteingang getrennt (nicht jeden Status-Tick) — schont API/RPC und Terminal. */
  useEffect(() => {
    if (!pollInbox) return
    const inboxPollMs = Math.max(pollIntervalMs, 15_000)
    const pollTick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void pollInbox()
    }
    const id = setInterval(pollTick, inboxPollMs)
    return () => clearInterval(id)
  }, [pollInbox, pollIntervalMs])

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

  const statusCacheAgeMinutes = useMemo(() => {
    const savedAt = Number(apiStatus?.cacheSavedAtMs ?? 0)
    if (!Number.isFinite(savedAt) || savedAt <= 0) return null
    const ageMs = Date.now() - savedAt
    if (!Number.isFinite(ageMs) || ageMs < 0) return null
    return Math.floor(ageMs / 60_000)
  }, [apiStatus?.cacheSavedAtMs])

  return { apiStatus, refreshApiStatus, basisUnreachable, packageIdMismatch, deviceTimeTrustWarn, statusCacheAgeMinutes }
}
