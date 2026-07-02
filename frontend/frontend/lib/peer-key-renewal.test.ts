import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  getCachedChainHandshakeProbe,
  invalidateChainHandshakeProbe,
  setCachedChainHandshakeProbe,
  shouldRunChainHandshakeProbe,
} from '@/frontend/lib/chain-handshake-probe-cache'

const peer = '0x' + 'a'.repeat(64)
const peerPubB64 = Buffer.alloc(65, 4).toString('base64')

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

describe('peer-key-renewal (H.23 A4)', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('rotiert epoch++, behält Peer-Pub und startet Handshake', async () => {
    const onHandshake = vi.fn()
    vi.doMock('@/frontend/lib/direct-chat-ecdh-session', () => ({
      getDirectChatEcdhPeerPubBase64: () => peerPubB64,
      setDirectChatEcdhPeerPubBase64: vi.fn(() => ({ ok: true as const })),
    }))
    vi.doMock('@/frontend/lib/direct-session-keys-archive', () => ({
      rotatePeerSessionEpochForRecipient: vi.fn(() => ({ ok: true as const, newEpoch: 2 })),
    }))
    vi.doMock('@/frontend/lib/api/execute-command', () => ({
      executeCommand: vi.fn(async () => ({ ok: true })),
    }))
    vi.doMock('@/frontend/lib/chain-handshake-probe-cache', () => ({
      invalidateChainHandshakeProbe: vi.fn(),
    }))
    const { renewDirectChatPeerEncryption } = await import('@/frontend/lib/peer-key-renewal')
    const r = await renewDirectChatPeerEncryption(peer, { onHandshake })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.newEpoch).toBe(2)
    expect(onHandshake).toHaveBeenCalledWith(peer)
  })

  it('blockiert ohne gespeicherten Peer-Pub', async () => {
    vi.doMock('@/frontend/lib/direct-chat-ecdh-session', () => ({
      getDirectChatEcdhPeerPubBase64: () => null,
      setDirectChatEcdhPeerPubBase64: vi.fn(),
    }))
    const { renewDirectChatPeerEncryption } = await import('@/frontend/lib/peer-key-renewal')
    const r = await renewDirectChatPeerEncryption(peer, { onHandshake: vi.fn() })
    expect(r.ok).toBe(false)
  })
})
