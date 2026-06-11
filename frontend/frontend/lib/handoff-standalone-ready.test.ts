import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  getStandaloneHelperReadiness,
  activateStandaloneHelperWallet,
} from './handoff-standalone-ready'

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: () => true,
}))

vi.mock('@/frontend/lib/dashboard-basis-offline-hint', () => ({
  isStandaloneMessengerWithoutBasis: () => true,
}))

describe('handoff-standalone-ready', () => {
  const store: Record<string, string> = {}

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
      dispatchEvent: vi.fn(),
    } as unknown as Window & typeof globalThis)
    store['morgendrot.autarkyMode'] = '1'
    store['morgendrot.iotaSubmitMode'] = 'client'
    store['morgendrot.directMailboxDrain'] = '1'
    store['morgendrot.directChainOptimisticFlags'] = '1'
    store['morgendrot.directIotaRpcUrl'] = 'https://rpc.example'
    store['morgendrot.directChain.packageId'] = '0x' + 'a'.repeat(64)
    store['morgendrot.directChain.mailboxId'] = '0x' + 'b'.repeat(64)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('needs mnemonic after handoff import', () => {
    store['morgendrot.handoff.localApplied.v1'] = JSON.stringify({
      savedAtMs: Date.now(),
      handoffLabel: 'Feld',
      packageId: '0x' + 'a'.repeat(64),
      mailboxId: '0x' + 'b'.repeat(64),
    })
    const r = getStandaloneHelperReadiness()
    expect(r.hasHandoff).toBe(true)
    expect(r.needsMnemonic).toBe(true)
    expect(r.configuredFromHandoff.packageId).toBe(true)
    expect(r.remainingStepLabels[0]).toMatch(/Mnemonic/)
  })

  it('reports no handoff on fresh device', () => {
    const r = getStandaloneHelperReadiness()
    expect(r.hasHandoff).toBe(false)
    expect(r.remainingStepLabels[0]).toMatch(/Handoff/)
  })
})
