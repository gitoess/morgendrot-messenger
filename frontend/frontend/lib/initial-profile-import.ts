/**
 * Einsatz-Profil (initialProfile) in der PWA: aus jsonConfig/Device-JSON extrahieren,
 * optional in localStorage einreihen, beim erreichbaren Backend per API übernehmen.
 * @see docs/API-INITIAL-PROFILE.md
 */
import { applyInitialProfileProvisioning } from './api'

const LS_PENDING = 'morgendrot.pendingInitialProfileJson'
const LS_DONE_FP = 'morgendrot.initialProfileAppliedFingerprint'

export function extractInitialProfileFromPaste(raw: string): Record<string, unknown> | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw.trim())
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const o = obj as Record<string, unknown>
  if (o.initialProfile && typeof o.initialProfile === 'object' && !Array.isArray(o.initialProfile)) {
    return o.initialProfile as Record<string, unknown>
  }
  if (o.version === 1 && Array.isArray(o.contacts)) {
    return o
  }
  return null
}

/** Stabiler Fingerabdruck für „bereits importiert“ (ohne Crypto). */
export function fingerprintInitialProfile(profile: Record<string, unknown>): string {
  const contacts = Array.isArray(profile.contacts) ? profile.contacts : []
  const parts = contacts
    .map((c) => {
      if (!c || typeof c !== 'object' || Array.isArray(c)) return ''
      const x = c as Record<string, unknown>
      const a = String(x.address || '').toLowerCase()
      const n = String(x.name || '')
      const tags = Array.isArray(x.roleTags)
        ? (x.roleTags as unknown[]).map((t) => String(t)).sort().join(',')
        : ''
      return `${a}|${n}|${tags}`
    })
    .filter(Boolean)
    .sort()
    .join(';;')
  const ch = String(profile.deploymentChannelTag || '')
  return `v1|${ch}|${parts}`
}

export function queueInitialProfileForNextApply(profile: Record<string, unknown>): void {
  try {
    localStorage.setItem(LS_PENDING, JSON.stringify(profile))
  } catch {
    /* ignore */
  }
}

export function clearPendingInitialProfile(): void {
  try {
    localStorage.removeItem(LS_PENDING)
  } catch {
    /* ignore */
  }
}

/**
 * Wendet gespeichertes Profil an (nach Backend-Start). Idempotent bei gleichem Fingerabdruck.
 */
export async function tryApplyPendingInitialProfileFromStorage(): Promise<{
  ok: boolean
  skipped?: boolean
  applied?: number
  message?: string
  error?: string
}> {
  if (typeof window === 'undefined') {
    return { ok: true, skipped: true }
  }
  let pendingRaw: string | null = null
  try {
    pendingRaw = localStorage.getItem(LS_PENDING)
  } catch {
    return { ok: false, error: 'localStorage nicht verfügbar' }
  }
  if (!pendingRaw?.trim()) {
    return { ok: true, skipped: true }
  }
  let profile: Record<string, unknown>
  try {
    profile = JSON.parse(pendingRaw) as Record<string, unknown>
  } catch {
    return { ok: false, error: 'Warteschlange: ungültiges JSON' }
  }
  const fp = fingerprintInitialProfile(profile)
  let doneFp: string | null = null
  try {
    doneFp = localStorage.getItem(LS_DONE_FP)
  } catch {
    /* ignore */
  }
  if (fp && fp === doneFp) {
    try {
      localStorage.removeItem(LS_PENDING)
    } catch {
      /* ignore */
    }
    return { ok: true, skipped: true, message: 'Profil war bereits importiert.' }
  }
  const res = await applyInitialProfileProvisioning(profile)
  if (!res.ok) {
    return { ok: false, error: res.error || 'Import fehlgeschlagen' }
  }
  try {
    if (fp) localStorage.setItem(LS_DONE_FP, fp)
    localStorage.removeItem(LS_PENDING)
  } catch {
    /* ignore */
  }
  return {
    ok: true,
    applied: res.applied,
    message: res.message || (res.applied != null ? `${res.applied} Kontakt(e) übernommen.` : undefined),
  }
}
