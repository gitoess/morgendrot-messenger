/**
 * § H.16 Boss-LAN: Installations-QR — PWA-URL (`w`) + optionale API-Basis (`b`), RPC (`u`).
 * @see docs/QR-CONTACT-SCHEMA-V2.md (getrennt von Kontakt `mc` und Peering `mp`)
 */

import { API_BASE_OVERRIDE_KEY, getApiBase } from '@/frontend/lib/api/api-base'

export type MorgendrotInstallQrV2 = {
  v: 2
  k: 'mi'
  /** Web/PWA-Seite zum Öffnen und Installieren (typ. :3341). */
  w: string
  /** Morgendrot-API-Basis (typ. :3342), nicht RPC. */
  b?: string
  /** IOTA RPC / Fullnode. */
  u?: string
  n?: string
}

export type ParsedInstallQr = {
  pwaUrl?: string
  apiBaseUrl?: string
  rpcUrl?: string
  label?: string
  source: 'mi' | 'url'
}

function normalizeHttpUrl(raw: string): string | null {
  const t = raw.trim()
  if (!/^https?:\/\//i.test(t)) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const path = u.pathname.replace(/\/$/, '')
    if (!path || path === '/') return u.origin
    return `${u.origin}${path}`
  } catch {
    return null
  }
}

export function buildInstallQrPayload(input: {
  pwaUrl: string
  apiBaseUrl?: string
  rpcUrl?: string
  label?: string
}): string {
  const w = normalizeHttpUrl(input.pwaUrl)
  if (!w) throw new Error('PWA-URL: http(s)://… erforderlich.')
  const o: MorgendrotInstallQrV2 = { v: 2, k: 'mi', w }
  const b = input.apiBaseUrl ? normalizeHttpUrl(input.apiBaseUrl) : null
  if (b) o.b = b
  const u = input.rpcUrl ? normalizeHttpUrl(input.rpcUrl) : null
  if (u) o.u = u
  const n = (input.label ?? '').trim()
  if (n) o.n = n.slice(0, 64)
  return JSON.stringify(o)
}

export function parseInstallQrPayload(raw: string): ParsedInstallQr | null {
  const t = raw.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t) && !t.startsWith('{')) {
    const w = normalizeHttpUrl(t)
    return w ? { pwaUrl: w, source: 'url' } : null
  }
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    if (j.v === 2 && j.k === 'mi') {
      const w = typeof j.w === 'string' ? normalizeHttpUrl(j.w) : null
      const b = typeof j.b === 'string' ? normalizeHttpUrl(j.b) : undefined
      const u = typeof j.u === 'string' ? normalizeHttpUrl(j.u) : undefined
      const n = typeof j.n === 'string' ? j.n.trim().slice(0, 64) : undefined
      if (!w && !b) return null
      return {
        ...(w ? { pwaUrl: w } : {}),
        ...(b ? { apiBaseUrl: b } : {}),
        ...(u ? { rpcUrl: u } : {}),
        ...(n ? { label: n } : {}),
        source: 'mi',
      }
    }
  } catch {
    /* fall through */
  }
  return null
}

export type ApplyInstallQrResult = { ok: true } | { ok: false; error: string }

/** API-Basis in localStorage (Capacitor/PWA-LAN). */
export function applyInstallQrApiBase(apiBaseUrl: string): ApplyInstallQrResult {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'Nur im Browser.' }
  }
  const normalized = normalizeHttpUrl(apiBaseUrl)
  if (!normalized) return { ok: false, error: 'Ungültige API-Basis-URL.' }
  try {
    window.localStorage.setItem(API_BASE_OVERRIDE_KEY, normalized)
    window.dispatchEvent(new CustomEvent('morgendrot.apiBaseChanged'))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function resolveBossLanInstallUrls(): {
  pwaUrl: string
  apiBaseUrl?: string
  loopbackWarning?: string
} {
  if (typeof window === 'undefined') {
    return { pwaUrl: '' }
  }
  const origin = window.location.origin.replace(/\/$/, '')
  let apiBaseUrl = getApiBase() || undefined
  if (!apiBaseUrl) {
    try {
      const u = new URL(origin)
      if (u.port === '3341') {
        u.port = '3342'
        apiBaseUrl = u.origin
      }
    } catch {
      /* ignore */
    }
  }
  const host = window.location.hostname
  const loopback =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
      ? 'QR zeigt diese URL — vom Handy aus nicht erreichbar. Am PC npm run dev:lan starten und die LAN-IP im Browser öffnen, dann QR erneut anzeigen.'
      : undefined
  return { pwaUrl: origin, apiBaseUrl, loopbackWarning: loopback }
}
