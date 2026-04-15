import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { uint8ToBase64 } from '@morgendrot/shared/bytes-base64'
import {
  applyDirectChatEcdhPrivateJwk,
  clearDirectChatEcdhPeerPubs,
  clearDirectChatEcdhPrivateKey,
  getDirectChatEcdhMaterialForRecipient,
  setDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'

const addr = '0x' + 'aa'.repeat(32)

describe('direct-chat-ecdh-session', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    clearDirectChatEcdhPrivateKey()
    vi.stubGlobal(
      'window',
      {
        localStorage: {
          getItem: (k: string) => (k in store ? store[k] : null),
          setItem: (k: string, v: string) => {
            store[k] = v
          },
          removeItem: (k: string) => {
            delete store[k]
          },
          clear: () => {
            Object.keys(store).forEach((k) => delete store[k])
          },
          key: () => null,
          length: 0,
        } as Storage,
      } as Window & typeof globalThis
    )
    clearDirectChatEcdhPeerPubs()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearDirectChatEcdhPrivateKey()
  })

  it('setDirectChatEcdhPeerPubBase64: lehnt ungültige Adresse ab', () => {
    const r = setDirectChatEcdhPeerPubBase64('not-hex', 'eA==')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Empfänger/)
  })

  it('Material nur wenn Privatkey + gespeicherter Peer-Pub', async () => {
    expect(getDirectChatEcdhMaterialForRecipient(addr)).toBeNull()
    const raw65 = new Uint8Array(65)
    raw65[0] = 4
    const b64 = uint8ToBase64(raw65)
    expect(setDirectChatEcdhPeerPubBase64(addr, b64).ok).toBe(true)
    expect(getDirectChatEcdhMaterialForRecipient(addr)).toBeNull()
    const pair = await globalThis.crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
      'deriveKey',
    ])
    const jwk = await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey)
    const imp = await applyDirectChatEcdhPrivateJwk(JSON.stringify(jwk))
    expect(imp.ok).toBe(true)
    const mat = getDirectChatEcdhMaterialForRecipient(addr)
    expect(mat).not.toBeNull()
    expect(mat?.peerPubRaw.length).toBe(65)
    clearDirectChatEcdhPeerPubs()
    expect(getDirectChatEcdhMaterialForRecipient(addr)).toBeNull()
  })

  it('leerer JWK entfernt Privatkey', async () => {
    const pair = await globalThis.crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
      'deriveKey',
    ])
    const jwk = await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey)
    await applyDirectChatEcdhPrivateJwk(JSON.stringify(jwk))
    const cleared = await applyDirectChatEcdhPrivateJwk('   ')
    expect(cleared.ok).toBe(true)
    expect(getDirectChatEcdhMaterialForRecipient(addr)).toBeNull()
  })
})
