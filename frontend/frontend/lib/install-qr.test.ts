import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  applyInstallQrApiBase,
  buildInstallQrPayload,
  parseInstallQrPayload,
  resolveBossLanInstallUrls,
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
    } as Window & typeof globalThis)
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

  it('apply speichert API-Basis', () => {
    const r = applyInstallQrApiBase('http://192.168.0.20:3342')
    expect(r.ok).toBe(true)
    expect(store['morgendrot.apiBaseOverride']).toBe('http://192.168.0.20:3342')
  })

  it('resolveBossLan leitet API von PWA-Port ab', () => {
    const r = resolveBossLanInstallUrls()
    expect(r.pwaUrl).toBe('http://192.168.0.10:3341')
    expect(r.apiBaseUrl).toBe('http://192.168.0.10:3342')
    expect(r.loopbackWarning).toBeUndefined()
  })
})
