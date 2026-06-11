/**
 * § H.16 Boss-LAN: Installations-QR — PWA-URL (`w`) + optionale API-Basis (`b`), RPC (`u`).
 * @see docs/QR-CONTACT-SCHEMA-V2.md (getrennt von Kontakt `mc` und Peering `mp`)
 */

import { API_BASE_OVERRIDE_KEY, getApiBase } from '@/frontend/lib/api/api-base'

export const LAN_INSTALL_HOST_KEY = 'morgendrot.lanInstallHost'

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

export type LanInstallCandidates = {
  hosts: string[]
  uiPort: number
  apiPort: number
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

export function isLoopbackHostname(host: string): boolean {
  const h = host.trim().toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '0.0.0.0'
}

export function readLanInstallHostOverride(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(LAN_INSTALL_HOST_KEY)?.trim() ?? ''
}

export function writeLanInstallHostOverride(host: string): void {
  if (typeof window === 'undefined') return
  const h = host.trim()
  if (!h) window.localStorage.removeItem(LAN_INSTALL_HOST_KEY)
  else window.localStorage.setItem(LAN_INSTALL_HOST_KEY, h)
}

export function inferUiAndApiPorts(): { uiPort: number; apiPort: number } {
  if (typeof window === 'undefined') return { uiPort: 3341, apiPort: 3342 }
  const uiPort = parseInt(window.location.port || '3341', 10) || 3341
  let apiPort = 3342
  const apiBase = getApiBase()
  if (apiBase) {
    try {
      apiPort = parseInt(new URL(apiBase).port || '3342', 10) || 3342
    } catch {
      /* ignore */
    }
  } else if (uiPort === 3341) {
    apiPort = 3342
  } else {
    apiPort = uiPort
  }
  return { uiPort, apiPort }
}

export function buildLanInstallUrls(host: string, uiPort?: number, apiPort?: number): {
  pwaUrl: string
  apiBaseUrl: string
} {
  const ports = inferUiAndApiPorts()
  const ui = uiPort ?? ports.uiPort
  const api = apiPort ?? ports.apiPort
  const h = host.trim()
  return {
    pwaUrl: `http://${h}:${ui}`,
    apiBaseUrl: `http://${h}:${api}`,
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

/** QR-Inhalt für Handy-Kamera: http(s)-Link (nicht JSON), optional mit API-Basis in `?b=`. */
export function buildInstallQrScanText(input: { pwaUrl: string; apiBaseUrl?: string }): string {
  const w = normalizeHttpUrl(input.pwaUrl)
  if (!w) throw new Error('PWA-URL: http(s)://… erforderlich.')
  try {
    const u = new URL(w)
    u.searchParams.set('mi', '1')
    const b = input.apiBaseUrl ? normalizeHttpUrl(input.apiBaseUrl) : null
    if (b) u.searchParams.set('b', b)
    return u.toString()
  } catch {
    throw new Error('PWA-URL: http(s)://… erforderlich.')
  }
}

function parseInstallHttpUrl(raw: string): ParsedInstallQr | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const bRaw = u.searchParams.get('b')
    const hasMi = u.searchParams.get('mi') === '1'
    if (bRaw || hasMi) {
      const b = bRaw ? normalizeHttpUrl(bRaw) : undefined
      u.searchParams.delete('mi')
      u.searchParams.delete('b')
      const w = normalizeHttpUrl(u.toString()) ?? normalizeHttpUrl(u.origin)
      if (!w && !b) return null
      return {
        ...(w ? { pwaUrl: w } : {}),
        ...(b ? { apiBaseUrl: b } : {}),
        source: 'url',
      }
    }
    const w = normalizeHttpUrl(raw)
    return w ? { pwaUrl: w, source: 'url' } : null
  } catch {
    return null
  }
}

export function stripInstallQrParamsFromUrl(href?: string): string {
  if (typeof window === 'undefined') return href ?? ''
  try {
    const u = new URL(href ?? window.location.href)
    if (!u.searchParams.has('mi') && !u.searchParams.has('b')) return u.toString()
    u.searchParams.delete('mi')
    u.searchParams.delete('b')
    const qs = u.searchParams.toString()
    return `${u.origin}${u.pathname}${qs ? `?${qs}` : ''}${u.hash}`
  } catch {
    return href ?? ''
  }
}

/** Nach WLAN-QR-Scan: API-Basis aus `?b=` übernehmen und URL bereinigen. */
export function applyInstallQrFromCurrentUrl(): ApplyInstallQrResult | null {
  if (typeof window === 'undefined') return null
  const parsed = parseInstallQrPayload(window.location.href)
  if (!parsed?.apiBaseUrl) return null
  const r = applyInstallQrApiBase(parsed.apiBaseUrl)
  if (r.ok) {
    const clean = stripInstallQrParamsFromUrl()
    window.history.replaceState({}, '', clean)
  }
  return r
}

export function parseInstallQrPayload(raw: string): ParsedInstallQr | null {
  const t = raw.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t) && !t.startsWith('{')) {
    return parseInstallHttpUrl(t)
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

/** LAN-Hosts vom Boss-Backend (networkInterfaces). */
export async function fetchLanInstallCandidates(): Promise<LanInstallCandidates | null> {
  if (typeof window === 'undefined') return null
  const base = getApiBase()
  if (!base) return null
  try {
    const r = await fetch(`${base}/api/lan-install-urls`, { cache: 'no-store' })
    if (!r.ok) return null
    const j = (await r.json()) as {
      ok?: boolean
      hosts?: string[]
      uiPort?: number
      apiPort?: number
    }
    if (!j.ok) return null
    return {
      hosts: Array.isArray(j.hosts) ? j.hosts.filter((h) => typeof h === 'string' && h.trim()) : [],
      uiPort: typeof j.uiPort === 'number' && j.uiPort > 0 ? j.uiPort : 3341,
      apiPort: typeof j.apiPort === 'number' && j.apiPort > 0 ? j.apiPort : 3342,
    }
  } catch {
    return null
  }
}

export function resolveBossLanInstallHost(hostOverride?: string): {
  host: string
  loopback: boolean
  uiPort: number
  apiPort: number
} {
  const ports = inferUiAndApiPorts()
  if (typeof window === 'undefined') {
    return { host: '', loopback: true, ...ports }
  }
  const hostname = window.location.hostname
  const loopback = isLoopbackHostname(hostname)
  const override = (hostOverride ?? readLanInstallHostOverride()).trim()
  if (override) {
    return { host: override, loopback, ...ports }
  }
  if (!loopback) {
    return { host: hostname, loopback: false, ...ports }
  }
  return { host: '', loopback: true, ...ports }
}

export function resolveBossLanInstallUrls(hostOverride?: string): {
  pwaUrl: string
  apiBaseUrl?: string
  loopback: boolean
  host: string
} {
  const resolved = resolveBossLanInstallHost(hostOverride)
  if (!resolved.host) {
    return { pwaUrl: '', apiBaseUrl: undefined, loopback: resolved.loopback, host: '' }
  }
  const urls = buildLanInstallUrls(resolved.host, resolved.uiPort, resolved.apiPort)
  return { ...urls, loopback: resolved.loopback, host: resolved.host }
}

/** Erster brauchbarer Host: Browser-LAN, gespeichert, oder Backend-Liste. */
export async function pickBossLanInstallHost(manualHost?: string): Promise<{
  host: string
  hosts: string[]
  uiPort: number
  apiPort: number
} | null> {
  const manual = manualHost?.trim()
  if (manual) {
    const ports = inferUiAndApiPorts()
    return { host: manual, hosts: [manual], ...ports }
  }

  const current = resolveBossLanInstallHost()
  if (current.host) {
    return { host: current.host, hosts: [current.host], uiPort: current.uiPort, apiPort: current.apiPort }
  }

  const fromApi = await fetchLanInstallCandidates()
  const saved = readLanInstallHostOverride()
  const hosts = fromApi?.hosts ?? []
  const uiPort = fromApi?.uiPort ?? current.uiPort
  const apiPort = fromApi?.apiPort ?? current.apiPort

  if (saved && (hosts.length === 0 || hosts.includes(saved))) {
    return { host: saved, hosts: hosts.length ? hosts : [saved], uiPort, apiPort }
  }
  if (hosts.length > 0) {
    return { host: hosts[0], hosts, uiPort, apiPort }
  }
  return null
}
