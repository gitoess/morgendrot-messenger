import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  applyInstallQrApiBase,
  applyInstallQrFromCurrentUrl,
  buildInstallQrPayload,
  buildInstallQrScanText,
  buildLanInstallUrls,
  isLoopbackHostname,
  parseInstallQrPayload,
  resolveBossLanInstallUrls,
  stripInstallQrParamsFromUrl,
} from './install-qr'

describe('install-qr (H.16 Boss-LAN)', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { origin: 'http://192.168.0.10:3341', hostname: '192.168.0.10', port: '3341' },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
      dispatchEvent: vi.fn(),
    } as unknown as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const k of Object.keys(store)) delete store[k]
  })

  it('build und parse mi', () => {
    const raw = buildInstallQrPayload({
      pwaUrl: 'http://192.168.0.10:3341',
      apiBaseUrl: 'http://192.168.0.10:3342',
      label: 'Boss',
    })
    const p = parseInstallQrPayload(raw)
    expect(p?.source).toBe('mi')
    expect(p?.pwaUrl).toBe('http://192.168.0.10:3341')
    expect(p?.apiBaseUrl).toBe('http://192.168.0.10:3342')
    expect(p?.label).toBe('Boss')
  })

  it('parst plain http URL', () => {
    const p = parseInstallQrPayload('http://192.168.1.5:3341/')
    expect(p?.source).toBe('url')
    expect(p?.pwaUrl).toBe('http://192.168.1.5:3341')
  })

  it('buildInstallQrScanText und parse mit ?b=', () => {
    const scan = buildInstallQrScanText({
      pwaUrl: 'http://192.168.0.10:3341',
      apiBaseUrl: 'http://192.168.0.10:3342',
    })
    expect(scan).toContain('mi=1')
    expect(scan).toContain('b=')
    const p = parseInstallQrPayload(scan)
    expect(p?.pwaUrl).toBe('http://192.168.0.10:3341')
    expect(p?.apiBaseUrl).toBe('http://192.168.0.10:3342')
  })

  it('applyInstallQrFromCurrentUrl übernimmt ?b= und bereinigt URL', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      location: {
        href: 'http://192.168.0.10:3341/?mi=1&b=http%3A%2F%2F192.168.0.10%3A3342',
        origin: 'http://192.168.0.10:3341',
        hostname: '192.168.0.10',
        port: '3341',
      },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
      history: { replaceState },
      dispatchEvent: vi.fn(),
    } as unknown as Window & typeof globalThis)
    const r = applyInstallQrFromCurrentUrl()
    expect(r?.ok).toBe(true)
    expect(store['morgendrot.apiBaseOverride']).toBe('http://192.168.0.10:3342')
    expect(replaceState).toHaveBeenCalledWith({}, '', 'http://192.168.0.10:3341/')
    expect(stripInstallQrParamsFromUrl('http://192.168.0.10:3341/?mi=1&b=x')).toBe(
      'http://192.168.0.10:3341/'
    )
  })

  it('apply speichert API-Basis', () => {
    const r = applyInstallQrApiBase('http://192.168.0.20:3342')
    expect(r.ok).toBe(true)
    expect(store['morgendrot.apiBaseOverride']).toBe('http://192.168.0.20:3342')
  })

  it('resolveBossLan auf LAN-Origin', () => {
    const r = resolveBossLanInstallUrls()
    expect(r.pwaUrl).toBe('http://192.168.0.10:3341')
    expect(r.apiBaseUrl).toBe('http://192.168.0.10:3342')
    expect(r.loopback).toBe(false)
    expect(r.host).toBe('192.168.0.10')
  })

  it('loopback ohne Override liefert leeren QR bis Host gewählt', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://127.0.0.1:3341', hostname: '127.0.0.1', port: '3341' },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
      dispatchEvent: vi.fn(),
    } as unknown as Window & typeof globalThis)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    const r = resolveBossLanInstallUrls()
    expect(r.pwaUrl).toBe('')
    expect(r.loopback).toBe(true)
    const withHost = resolveBossLanInstallUrls('192.168.0.55')
    expect(withHost.pwaUrl).toBe('http://192.168.0.55:3341')
  })

  it('buildLanInstallUrls', () => {
    expect(buildLanInstallUrls('192.168.0.10', 3341, 3342)).toEqual({
      pwaUrl: 'http://192.168.0.10:3341',
      apiBaseUrl: 'http://192.168.0.10:3342',
    })
  })
})
