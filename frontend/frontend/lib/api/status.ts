import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseJsonObjectRecord } from '@/frontend/lib/api-response-guard'
import { parseUnlockApiResponse, type UnlockBackendResult } from '@/frontend/lib/api/unlock-response-parse'
import { API_BASE, getApiBase } from '@/frontend/lib/api/api-base'
import type { StatusPollClockHint } from '@/frontend/lib/device-time-trust'
import { OFFLINE_CACHE_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { broadcastPinnwandStatusFromHandoff } from '@/frontend/lib/broadcast-pinnwand-handoff-status'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'

export type {
  ApiStatus,
  ApiStatusFetchOk,
  ApiStatusFetchResult,
  HierarchyPermissions,
  VaultStatus,
} from '@/frontend/lib/api/api-status-types'
import type { ApiStatus, ApiStatusFetchResult } from '@/frontend/lib/api/api-status-types'

function parseResponseDateMs(res: Response): number | null {
  const raw = res.headers.get('date')
  if (raw == null || !raw.trim()) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

/** Ohne Timeout hängt `fetch` bei totem LAN-Host (Dev-Server aus) oft sehr lange — Handy zeigt erst spät „Basis offline“. */
const STATUS_FETCH_TIMEOUT_MS = 10_000
const STATUS_CACHE_KEY = 'morgendrot.apiStatus.lastOk.v1'

type CachedStatusEnvelope = {
  savedAtMs: number
  status: ApiStatus
}

export const API_STATUS_CACHE_KEY = STATUS_CACHE_KEY

/** § H.32b — gecachten `/api/status`-Snapshot entfernen. */
export function clearCachedApiStatusSnapshot(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STATUS_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

function cacheStatusSnapshot(status: ApiStatus): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: CachedStatusEnvelope = { savedAtMs: Date.now(), status }
    window.localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(envelope))
  } catch {
    // Speicher voll / gesperrt: kein Hard-Fail fuer den Status-Poll.
  }
}

/** Sofort-Hydration beim Chat-Start (Pinnwand, Rolle, Package) — ohne Netzwerk. */
export function readBootstrapCachedApiStatus(): (ApiStatus & { pollClockHint: StatusPollClockHint }) | null {
  const cached = readCachedStatusSnapshot()
  if (!cached) return null
  return { ...cached.status, pollClockHint: cached.pollClockHint }
}

function readCachedStatusSnapshot():
  | { status: ApiStatus; pollClockHint: StatusPollClockHint }
  | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STATUS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedStatusEnvelope>
    const status = (parsed.status ?? null) as ApiStatus | null
    const savedAtMs = Number(parsed.savedAtMs ?? 0)
    if (!status || !Number.isFinite(savedAtMs) || savedAtMs <= 0) return null
    const ageMs = Date.now() - savedAtMs
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > OFFLINE_CACHE_TTL_MS) return null
    return {
      status: {
        ...status,
        fromCache: true,
        backendOnline: false,
        backendRunning: false,
        cacheSavedAtMs: savedAtMs,
      },
      pollClockHint: { okAtMs: savedAtMs, httpDateUtcMs: null },
    }
  } catch {
    return null
  }
}

function readLocalHandoffStatusFallback():
  | { status: ApiStatus; pollClockHint: StatusPollClockHint }
  | null {
  const local = readLocalHandoffAppliedSnapshot()
  if (!local) return null
  const broadcastPinnwand = broadcastPinnwandStatusFromHandoff(local)
  return {
    status: {
      backendOnline: false,
      backendRunning: false,
      connected: false,
      fromCache: true,
      fromLocalHandoff: true,
      cacheSavedAtMs: local.savedAtMs,
      handoffLabel: local.handoffLabel,
      role: local.role,
      deploymentProfile: local.deploymentProfile,
      transportProfile: local.transportProfile,
      uiVariant: local.uiVariant,
      simpleMode: local.simpleMode,
      packageId: local.packageId,
      mailboxId: local.mailboxId,
      ...(broadcastPinnwand ? { broadcastPinnwand } : {}),
    },
    pollClockHint: { okAtMs: local.savedAtMs, httpDateUtcMs: null },
  }
}

export async function fetchStatus(): Promise<ApiStatusFetchResult> {
  const apiBase = getApiBase()
  const { shouldPreferStandaloneHandoffStatus, readStandaloneDeviceStatusFallback } = await import(
    '@/frontend/lib/capacitor-standalone-bootstrap'
  )
  const { isCapacitorNativePlatform } = await import('@/frontend/lib/capacitor-platform')
  const standaloneFirst =
    isCapacitorNativePlatform() && (!apiBase.trim() || shouldPreferStandaloneHandoffStatus())
  if (standaloneFirst) {
    const standalone = readStandaloneDeviceStatusFallback()
    if (standalone) {
      return { ...standalone.status, pollClockHint: standalone.pollClockHint }
    }
  }
  try {
    const fr = await fetchApiText(apiBase || API_BASE, '/api/status', {
      signal: AbortSignal.timeout(STATUS_FETCH_TIMEOUT_MS),
    })
    if (!fr.ok) {
      const cached = readCachedStatusSnapshot()
      if (cached) {
        console.info('[status] Live-Request fehlgeschlagen, nutze Cache-Fallback.', { error: fr.error })
        return { ...cached.status, pollClockHint: cached.pollClockHint, error: fr.error }
      }
      const localHandoff = readLocalHandoffStatusFallback()
      if (localHandoff) {
        console.info('[status] Live-Request fehlgeschlagen, nutze lokalen Handoff-Fallback.', { error: fr.error })
        return { ...localHandoff.status, pollClockHint: localHandoff.pollClockHint, error: fr.error }
      }
      return {
        backendRunning: false,
        connected: false,
        error: fr.error,
      }
    }
    const p = parseJsonObjectRecord(fr.text)
    if (!p.ok) {
      const cached = readCachedStatusSnapshot()
      if (cached) {
        const err =
          p.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).'
        console.info('[status] Ungültige Live-Antwort, nutze Cache-Fallback.', { error: err })
        return { ...cached.status, pollClockHint: cached.pollClockHint, error: err }
      }
      const localHandoff = readLocalHandoffStatusFallback()
      if (localHandoff) {
        const err =
          p.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).'
        console.info('[status] Ungültige Live-Antwort, nutze lokalen Handoff-Fallback.', { error: err })
        return { ...localHandoff.status, pollClockHint: localHandoff.pollClockHint, error: err }
      }
      return {
        backendRunning: false,
        connected: false,
        error:
          p.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).',
      }
    }
    const data = p.data as ApiStatus & { backendRunning?: boolean }
    const pollClockHint: StatusPollClockHint = {
      okAtMs: Date.now(),
      httpDateUtcMs: parseResponseDateMs(fr.response),
    }
    const liveStatus: ApiStatus = {
      ...data,
      backendRunning: data.backendRunning !== false,
      backendOnline: true,
      fromCache: false,
    }
    cacheStatusSnapshot(liveStatus)
    return { ...liveStatus, pollClockHint }
  } catch (error) {
    const cached = readCachedStatusSnapshot()
    if (cached) {
      console.info('[status] Ausnahme beim Live-Request, nutze Cache-Fallback.', {
        error: formatFetchFailureMessage(error),
      })
      return { ...cached.status, pollClockHint: cached.pollClockHint, error: formatFetchFailureMessage(error) }
    }
    const localHandoff = readLocalHandoffStatusFallback()
    if (localHandoff) {
      const err = formatFetchFailureMessage(error)
      console.info('[status] Ausnahme beim Live-Request, nutze lokalen Handoff-Fallback.', { error: err })
      return { ...localHandoff.status, pollClockHint: localHandoff.pollClockHint, error: err }
    }
    return {
      backendRunning: false,
      connected: false,
      error: formatFetchFailureMessage(error),
    }
  }
}

export type { UnlockBackendResult }

export async function unlockBackend(
  password: string,
  opts?: { sdkSignerImport?: string; createNew?: boolean }
): Promise<UnlockBackendResult> {
  try {
    const body: Record<string, string | boolean> = { password }
    const extra = (opts?.sdkSignerImport ?? '').trim()
    if (extra) body.sdkSignerImport = extra
    if (opts?.createNew === true) body.createNew = true
    const fr = await fetchApiText(API_BASE, '/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    return parseUnlockApiResponse(fr.text, fr.response.ok)
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
