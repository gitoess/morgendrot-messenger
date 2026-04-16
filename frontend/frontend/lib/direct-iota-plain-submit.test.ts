import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getDirectIotaPathUiState,
  getIotaSubmitMode,
  setIotaSubmitMode,
  trySubmitPlaintextMailboxViaDirectIota,
} from '@/frontend/lib/direct-iota-plain-submit'

describe('direct-iota-plain-submit (H.15 Stufe 2 — Smoke-Mindestabdeckung)', () => {
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

  it('getIotaSubmitMode / setIotaSubmitMode: client als Default, relay persistiert', () => {
    expect(getIotaSubmitMode()).toBe('client')
    setIotaSubmitMode('relay')
    expect(store['morgendrot.iotaSubmitMode']).toBe('relay')
    expect(getIotaSubmitMode()).toBe('relay')
    setIotaSubmitMode('client')
    expect(store['morgendrot.iotaSubmitMode']).toBeUndefined()
    expect(getIotaSubmitMode()).toBe('client')
  })

  it('getDirectIotaPathUiState: Relay vs Client ohne RPC', () => {
    expect(getDirectIotaPathUiState().mode).toBe('client')
    expect(getDirectIotaPathUiState().headline).toContain('Direkt gewählt')
    setIotaSubmitMode('relay')
    expect(getDirectIotaPathUiState().mode).toBe('relay')
    expect(getDirectIotaPathUiState().headline).toContain('Relay')
  })

  it('trySubmitPlaintextMailboxViaDirectIota: bricht bei Modus Nur-API ab', async () => {
    setIotaSubmitMode('relay')
    const r = await trySubmitPlaintextMailboxViaDirectIota({
      recipient: '0x' + '11'.repeat(32),
      payloadUtf8: 'x',
      nonce: BigInt(1),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Nur Morgendrot-API/)
  })

  it('trySubmitPlaintextMailboxViaDirectIota: bricht ab wenn Drain aus', async () => {
    store['morgendrot.directMailboxDrain'] = '0'
    const r = await trySubmitPlaintextMailboxViaDirectIota({
      recipient: '0x' + '11'.repeat(32),
      payloadUtf8: 'x',
      nonce: BigInt(1),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Drain/)
  })
})
