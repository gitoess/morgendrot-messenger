import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  applyPeeringQrImport,
  applyPeeringQrNetworkHints,
  buildPeeringQrPayload,
  parsePeeringQrPayload,
} from './peering-qr'

vi.mock('@/frontend/lib/direct-iota-rpc', () => ({
  setBrowserDirectIotaRpcUrlOverride: vi.fn(),
}))
vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  persistDirectChainFieldIds: vi.fn(),
}))

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

  it('parse mp mit RPC und Package', () => {
    const raw = buildPeeringQrPayload({
      address: ADDR,
      rpcUrl: 'https://rpc.testnet.example',
      packageId: '0x' + '11'.repeat(32),
    })
    const p = parsePeeringQrPayload(raw)
    expect(p?.rpcUrl).toBe('https://rpc.testnet.example')
    expect(p?.packageId?.toLowerCase()).toBe(('0x' + '11'.repeat(32)).toLowerCase())
  })

  it('applyPeeringQrNetworkHints setzt RPC und Package', async () => {
    const { setBrowserDirectIotaRpcUrlOverride } = await import('@/frontend/lib/direct-iota-rpc')
    const { persistDirectChainFieldIds } = await import('@/frontend/lib/direct-iota-chain-context')
    const pkg = '0x' + '22'.repeat(32)
    const r = applyPeeringQrNetworkHints({
      rpcUrl: 'https://fullnode.example',
      packageId: pkg,
    })
    expect(r.applied).toContain('RPC-URL')
    expect(r.applied).toContain('Package-ID')
    expect(setBrowserDirectIotaRpcUrlOverride).toHaveBeenCalledWith('https://fullnode.example')
    expect(persistDirectChainFieldIds).toHaveBeenCalledWith({ packageId: pkg })
  })
})
