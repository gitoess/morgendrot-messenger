import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  addConnectedPeerToLocalSnapshot,
  readConnectedPeersSnapshot,
  resolveConnectedAddresses,
} from './connected-peers-snapshot'

describe('connected-peers-snapshot add', () => {
  const store: Record<string, string> = {}
  const ADDR = '0x' + 'bb'.repeat(32)

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
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

  it('addConnectedPeerToLocalSnapshot merged Adressen', () => {
    addConnectedPeerToLocalSnapshot(ADDR)
    const r = resolveConnectedAddresses({ fromStatus: [], preferCacheWhenEmpty: true })
    expect(r.fromCache).toBe(true)
    expect(r.addresses[0]).toBe(ADDR.toLowerCase())
    expect(readConnectedPeersSnapshot()?.addresses).toContain(ADDR.toLowerCase())
  })
})
