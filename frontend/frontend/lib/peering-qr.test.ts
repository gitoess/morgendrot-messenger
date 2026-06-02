import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  applyPeeringQrImport,
  buildPeeringQrPayload,
  parsePeeringQrPayload,
} from './peering-qr'

const ADDR = '0x' + 'aa'.repeat(32)
const PUB_B64 = 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

describe('peering-qr (H.16)', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
    } as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('build und parse mp', () => {
    const raw = buildPeeringQrPayload({ address: ADDR, ecdhPubB64: PUB_B64, displayName: 'Bob' })
    const p = parsePeeringQrPayload(raw)
    expect(p?.source).toBe('mp')
    expect(p?.address.toLowerCase()).toBe(ADDR.toLowerCase())
    expect(p?.ecdhPubB64).toBe(PUB_B64)
    expect(p?.displayName).toBe('Bob')
  })

  it('apply speichert Peer-Pub', () => {
    const p = parsePeeringQrPayload(buildPeeringQrPayload({ address: ADDR, ecdhPubB64: PUB_B64 }))!
    const r = applyPeeringQrImport(p)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.peerPubStored).toBe(true)
  })
})
