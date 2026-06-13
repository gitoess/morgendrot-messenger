import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/frontend/lib/messenger-standalone-relay', () => ({
  shouldSkipMessengerApiRelayFallback: vi.fn(() => true),
}))

const findPeerHandshakeMock = vi.fn()
vi.mock('@/frontend/lib/api/package-connect', () => ({
  findPeerHandshake: (...args: unknown[]) => findPeerHandshakeMock(...args),
}))

import { getDirectChatEcdhPrivateKey, setDirectChatEcdhPeerPubBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import { applyDirectChatEcdhPrivateJwk } from '@/frontend/lib/direct-chat-ecdh-session'
import { ensureDirectChatPeerPubForRecipient } from '@/frontend/lib/direct-iota-encrypted-send-prep'
import { shouldSkipMessengerApiRelayFallback } from '@/frontend/lib/messenger-standalone-relay'

describe('direct-iota-encrypted-send-prep', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    findPeerHandshakeMock.mockReset()
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
    store['morgendrot.directMailboxDrain'] = '1'
    store['morgendrot.directChain.optimisticFlags'] = '1'
    store['morgendrot.directIotaRpcUrl'] = 'https://rpc.test'
    const pkg = '0x' + 'a'.repeat(64)
    const mb = '0x' + 'b'.repeat(64)
    const addr = '0x' + 'c'.repeat(64)
    store['morgendrot.directChain.packageId'] = pkg
    store['morgendrot.directChain.mailboxId'] = mb
    store['morgendrot.directChain.senderAddress'] = addr
    store['morgendrot.directChain.flagsJson'] = JSON.stringify({
      useMailbox: true,
      mailboxStorePlaintext: true,
      messengerCreditsConfigured: false,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shouldSkipMessengerApiRelayFallback wenn Standalone ohne Basis', () => {
    expect(shouldSkipMessengerApiRelayFallback()).toBe(true)
  })

  it('ensureDirectChatPeerPub speichert Peer von Fullnode', async () => {
    const peer = '0x' + 'd'.repeat(64)
    findPeerHandshakeMock.mockResolvedValue({
      ok: true,
      found: true,
      peerPubRawBase64: 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    })
    const r = await ensureDirectChatPeerPubForRecipient(peer)
    expect(r.ok).toBe(true)
    expect(findPeerHandshakeMock).toHaveBeenCalledWith(peer)
  })

  it('JWK aus Puls wird in localStorage persistiert', async () => {
    const pair = await globalThis.crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
      'deriveKey',
    ])
    const jwk = await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey)
    const imp = await applyDirectChatEcdhPrivateJwk(JSON.stringify(jwk))
    expect(imp.ok).toBe(true)
    expect(getDirectChatEcdhPrivateKey()).not.toBeNull()
    expect(store['morgendrot.directChatEcdh.privateJwk.v1']).toBeTruthy()
  })
})
