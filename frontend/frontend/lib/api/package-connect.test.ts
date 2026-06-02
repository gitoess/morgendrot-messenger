import { describe, it, expect, vi, beforeEach } from 'vitest'

const tryFetchHandshakeOffersViaDirectIota = vi.fn()
const tryFindPeerHandshakeViaDirectIota = vi.fn()
const shouldSkipMessengerApiRelayFallback = vi.fn(() => false)

vi.mock('@/frontend/lib/direct-iota-handshake-fetch', () => ({
  canFetchHandshakesViaDirectIota: () => true,
  tryFetchHandshakeOffersViaDirectIota: (...args: unknown[]) => tryFetchHandshakeOffersViaDirectIota(...args),
  tryFindPeerHandshakeViaDirectIota: (...args: unknown[]) => tryFindPeerHandshakeViaDirectIota(...args),
}))

vi.mock('@/frontend/lib/messenger-standalone-relay', () => ({
  shouldSkipMessengerApiRelayFallback: () => shouldSkipMessengerApiRelayFallback(),
}))

vi.mock('@/frontend/lib/handshake-offers-cache', () => ({
  cacheHandshakeOffers: vi.fn(),
  readCachedHandshakeOffers: () => null,
}))

vi.mock('@/frontend/lib/pending-handshake-mailbox-ids', () => ({
  readClientMailboxIdsForHandshakeScan: () => [],
}))

import { fetchHandshakeOffers, findPeerHandshake } from '@/frontend/lib/api/package-connect'

describe('package-connect standalone', () => {
  beforeEach(() => {
    tryFetchHandshakeOffersViaDirectIota.mockReset()
    tryFindPeerHandshakeViaDirectIota.mockReset()
    shouldSkipMessengerApiRelayFallback.mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn())
  })

  it('fetchHandshakeOffers: kein /api/pending-handshakes wenn Standalone', async () => {
    shouldSkipMessengerApiRelayFallback.mockReturnValue(true)
    tryFetchHandshakeOffersViaDirectIota.mockResolvedValue({
      ok: false,
      offers: [],
      outgoingOffers: [],
      error: 'rpc down',
    })
    const r = await fetchHandshakeOffers()
    expect(r.ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    expect(r.error).toMatch(/rpc down/)
  })

  it('findPeerHandshake: kein /api/find-peer-handshake wenn Standalone', async () => {
    shouldSkipMessengerApiRelayFallback.mockReturnValue(true)
    const peer = '0x' + 'aa'.repeat(32)
    tryFindPeerHandshakeViaDirectIota.mockResolvedValue({ ok: true, found: false })
    const r = await findPeerHandshake(peer)
    expect(r.ok).toBe(true)
    expect(r.found).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
