import { describe, expect, it, vi } from 'vitest'
import {
  getCachedChainHandshakeProbe,
  invalidateChainHandshakeProbe,
  setCachedChainHandshakeProbe,
  shouldRunChainHandshakeProbe,
} from '@/frontend/lib/chain-handshake-probe-cache'

const peer = '0x' + 'a'.repeat(64)

describe('chain-handshake-probe-cache', () => {
  it('speichert positive und negative Sonden', () => {
    invalidateChainHandshakeProbe(peer)
    expect(shouldRunChainHandshakeProbe(peer)).toBe(true)
    setCachedChainHandshakeProbe(peer, false)
    expect(getCachedChainHandshakeProbe(peer)).toBe('not_found')
    expect(shouldRunChainHandshakeProbe(peer)).toBe(false)
    setCachedChainHandshakeProbe(peer, true)
    expect(getCachedChainHandshakeProbe(peer)).toBe('found')
  })
})

describe('peer-key-renewal', () => {
  it('löscht Peer-Pub und startet Handshake', async () => {
    vi.resetModules()
    const setPeer = vi.fn(() => ({ ok: true as const }))
    vi.doMock('@/frontend/lib/direct-chat-ecdh-session', () => ({
      setDirectChatEcdhPeerPubBase64: setPeer,
    }))
    vi.doMock('@/frontend/lib/chain-handshake-probe-cache', () => ({
      invalidateChainHandshakeProbe: vi.fn(),
    }))
    const { renewDirectChatPeerEncryption } = await import('@/frontend/lib/peer-key-renewal')
    const onHandshake = vi.fn()
    const r = await renewDirectChatPeerEncryption(peer, { onHandshake })
    expect(r.ok).toBe(true)
    expect(setPeer).toHaveBeenCalledWith(peer, '')
    expect(onHandshake).toHaveBeenCalledWith(peer)
  })
})
