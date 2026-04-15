import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setIotaSubmitMode } from '@/frontend/lib/direct-iota-plain-submit'
import { trySubmitEncryptedMailboxViaDirectIota } from '@/frontend/lib/direct-iota-encrypted-submit'

describe('direct-iota-encrypted-submit (H.15 — Smoke)', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const hexId = '0x' + '11'.repeat(32)
  const iv = new Uint8Array(12).fill(1)
  const tag = new Uint8Array(16).fill(2)
  const ct = new Uint8Array([9])

  it('trySubmitEncryptedMailboxViaDirectIota: bricht bei Modus Nur-API ab', async () => {
    setIotaSubmitMode('relay')
    const r = await trySubmitEncryptedMailboxViaDirectIota({
      recipient: hexId,
      ciphertext: ct,
      iv,
      tag,
      nonce: BigInt(1),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Nur Morgendrot-API/)
  })

  it('trySubmitEncryptedMailboxViaDirectIota: bricht ab wenn Drain aus', async () => {
    store['morgendrot.directMailboxDrain'] = '0'
    const r = await trySubmitEncryptedMailboxViaDirectIota({
      recipient: hexId,
      ciphertext: ct,
      iv,
      tag,
      nonce: BigInt(1),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Drain/)
  })
})
