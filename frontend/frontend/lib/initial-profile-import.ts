/**
 * Einsatz-Profil (initialProfile) in der PWA: aus jsonConfig/Device-JSON extrahieren,
 * optional in localStorage einreihen, beim erreichbaren Backend per API übernehmen.
 * @see docs/API-INITIAL-PROFILE.md
 */
import { applyInitialProfileProvisioning } from './api'

const LS_PENDING = 'morgendrot.pendingInitialProfileJson'
const LS_DONE_FP = 'morgendrot.initialProfileAppliedFingerprint'
/** Anzeige der Boss-Notiz (`offlineBriefing`) in den Einstellungen */
export const LS_OFFLINE_BRIEFING_DISPLAY = 'morgendrot.offlineBriefingDisplay'

/** Kurz-Zusammenfassung für die Boss-Import-UI (ohne volles JSON anzeigen). */
export type InitialProfileSummary = {
  contactCount: number
  contactPreview: string[]
  deploymentChannelTag?: string
  hasOfflineBriefing: boolean
}

export function summarizeInitialProfile(profile: Record<string, unknown>): InitialProfileSummary {
  const contacts = Array.isArray(profile.contacts) ? profile.contacts : []
  const contactPreview = contacts.slice(0, 6).map((c) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return 'Unbenannt'
    const x = c as Record<string, unknown>
    const name = String(x.name ?? x.label ?? '').trim() || 'Unbenannt'
    const addr = String(x.address ?? '').trim()
    if (/^0x[a-fA-F0-9]{64}$/i.test(addr)) return `${name} · ${addr.slice(0, 10)}…`
    return name
  })
  const ch = profile.deploymentChannelTag
  return {
    contactCount: contacts.length,
    contactPreview,
    deploymentChannelTag: typeof ch === 'string' && ch.trim() ? ch.trim() : undefined,
    hasOfflineBriefing: typeof profile.offlineBriefing === 'string' && profile.offlineBriefing.trim().length > 0,
  }
}

/** Speichert optionale Einsatz-Notiz lokal (Klartext, Browser-Storage). */
export function persistOfflineBriefingFromProfile(profile: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const b = profile.offlineBriefing
  if (typeof b === 'string' && b.trim()) {
    try {
      localStorage.setItem(LS_OFFLINE_BRIEFING_DISPLAY, b.trim())
    } catch {
      /* ignore */
    }
  }
}

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
  const vu = typeof profile.validUntil === 'number' && Number.isFinite(profile.validUntil) ? String(profile.validUntil) : ''
  const meta = profile.metadata && typeof profile.metadata === 'object' && !Array.isArray(profile.metadata)
    ? Object.keys(profile.metadata as Record<string, unknown>)
        .sort()
        .map((k) => `${k}=${String((profile.metadata as Record<string, unknown>)[k] ?? '')}`)
        .join('&')
    : ''
  const ob =
    typeof profile.offlineBriefing === 'string' ? profile.offlineBriefing.trim().slice(0, 120) : ''
  return `v1|${ch}|vu:${vu}|m:${meta}|ob:${ob}|${parts}`
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
  persistOfflineBriefingFromProfile(profile)
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
