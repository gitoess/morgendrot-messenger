import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { canTryDirectConnectPeer } from './direct-iota-connect'

vi.mock('@/frontend/lib/direct-iota-handshake-fetch', () => ({
  canFetchHandshakesViaDirectIota: () => true,
}))

describe('direct-iota-connect', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {} as Window & typeof globalThis)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('canTryDirectConnectPeer', () => {
    expect(canTryDirectConnectPeer()).toBe(true)
  })
})
