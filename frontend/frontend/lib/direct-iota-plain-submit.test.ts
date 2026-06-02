import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as mnemonicSession from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  canTryLivePlaintextDirectMailbox,
  getDirectIotaPathUiShortLine,
  getDirectIotaPathUiState,
  getIotaSubmitMode,
  getAutarkyChecklistItems,
  listDirectIotaSetupGaps,
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

  it('getDirectIotaPathUiState: Basis-offline-Hinweis bei aktivem Direct', () => {
    const addr = '0x' + '33'.repeat(32)
    store['morgendrot.directMailboxDrain'] = '1'
    store['morgendrot.directIotaRpcUrl'] = 'https://fullnode.example'
    store['morgendrot.directChain.packageId'] = '0x' + '11'.repeat(32)
    store['morgendrot.directChain.mailboxId'] = '0x' + '22'.repeat(32)
    store['morgendrot.directChain.senderAddress'] = addr
    store['morgendrot.directChain.flagsJson'] = JSON.stringify({
      useMailbox: true,
      mailboxStorePlaintext: true,
      messengerCreditsConfigured: false,
    })
    vi.spyOn(mnemonicSession, 'getDirectIotaSessionSignerAddress').mockReturnValue(addr)
    vi.spyOn(mnemonicSession, 'getDirectIotaSessionSigner').mockReturnValue({} as ReturnType<
      typeof mnemonicSession.getDirectIotaSessionSigner
    >)
    const detail = getDirectIotaPathUiState({ backendOnline: false }).detail
    expect(detail).toMatch(/Basis offline/)
    expect(getDirectIotaPathUiShortLine({ backendOnline: false })).toMatch(/Basis offline/)
  })

  it('canTryLivePlaintextDirectMailbox: false im Nur-Relay-Modus', () => {
    store['morgendrot.directMailboxDrain'] = '1'
    setIotaSubmitMode('relay')
    expect(canTryLivePlaintextDirectMailbox()).toBe(false)
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

  it('listDirectIotaSetupGaps: Relay-Modus ohne Lücken', () => {
    setIotaSubmitMode('relay')
    expect(listDirectIotaSetupGaps()).toEqual([])
  })

  it('getAutarkyChecklistItems: Ketten-IDs aus getDirectChainIdsReadiness', () => {
    const pkg = '0x' + '11'.repeat(32)
    const mb = '0x' + '22'.repeat(32)
    const addr = '0x' + '33'.repeat(32)
    store['morgendrot.directChain.packageId'] = pkg
    store['morgendrot.directChain.mailboxId'] = mb
    store['morgendrot.directChain.senderAddress'] = addr
    store['morgendrot.directIotaRpcUrl'] = 'https://fullnode.example'
    store['morgendrot.directMailboxDrain'] = '1'
    store['morgendrot.directChain.optimisticFlags'] = '1'
    const items = getAutarkyChecklistItems()
    const idsItem = items.find((i) => i.label.includes('Package'))
    expect(idsItem?.ok).toBe(true)
    expect(items.find((i) => i.label.includes('Fullnode'))?.ok).toBe(true)
  })

  it('getAutarkyChecklistItems: zeigt fehlende Ketten-IDs', () => {
    store['morgendrot.directIotaRpcUrl'] = 'https://fullnode.example'
    const items = getAutarkyChecklistItems()
    const idsItem = items.find((i) => i.label.startsWith('Ketten-IDs fehlen'))
    expect(idsItem?.ok).toBe(false)
    expect(idsItem?.label).toMatch(/Package-ID/)
  })

  it('listDirectIotaSetupGaps: nennt fehlende RPC und Drain', () => {
    setIotaSubmitMode('client')
    const gaps = listDirectIotaSetupGaps()
    expect(gaps.some((g) => g.includes('Fullnode'))).toBe(true)
    expect(gaps.some((g) => g.includes('Drain'))).toBe(true)
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
