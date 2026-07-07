import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  getStandaloneHelperReadiness,
  activateStandaloneHelperWallet,
  shouldShowHelperSeedSetupDialog,
  isHelperHandoffProfileForSeedSetup,
  notifyStandaloneWalletActivated,
} from './handoff-standalone-ready'

const standaloneWithoutBasis = vi.hoisted(() => vi.fn(() => true))
const sessionSignerAddress = vi.hoisted(() => vi.fn(() => ''))

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: () => true,
}))

vi.mock('@/frontend/lib/dashboard-basis-offline-hint', () => ({
  isStandaloneMessengerWithoutBasis: () => standaloneWithoutBasis(),
}))

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  applyDirectIotaMnemonicSession: vi.fn(),
  getDirectIotaSessionSigner: () => (sessionSignerAddress() ? {} : null),
  getDirectIotaSessionSignerAddress: () => sessionSignerAddress(),
  persistDirectIotaSessionSignerEncrypted: vi.fn(),
  getIncludeSdkMnemonicInBackup: () => false,
}))

describe('handoff-standalone-ready', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    standaloneWithoutBasis.mockReturnValue(true)
    sessionSignerAddress.mockReturnValue('')
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

  it('needs mnemonic for helper handoff even when boss wallet is in session', () => {
    store['morgendrot.handoff.localApplied.v1'] = JSON.stringify({
      savedAtMs: Date.now(),
      handoffLabel: 'Feld',
      role: 'messenger',
      simpleMode: true,
      packageId: '0x' + 'a'.repeat(64),
      mailboxId: '0x' + 'b'.repeat(64),
    })
    sessionSignerAddress.mockReturnValue('0x' + 'c'.repeat(64))
    const r = getStandaloneHelperReadiness()
    expect(r.needsMnemonic).toBe(true)
    expect(shouldShowHelperSeedSetupDialog()).toBe(true)
  })

  it('clears helper mnemonic need after wallet activation marker', () => {
    const savedAtMs = Date.now()
    store['morgendrot.handoff.localApplied.v1'] = JSON.stringify({
      savedAtMs,
      role: 'messenger',
      simpleMode: true,
      packageId: '0x' + 'a'.repeat(64),
      mailboxId: '0x' + 'b'.repeat(64),
    })
    sessionSignerAddress.mockReturnValue('0x' + 'c'.repeat(64))
    notifyStandaloneWalletActivated()
    expect(shouldShowHelperSeedSetupDialog()).toBe(false)
  })

  it('shows helper seed dialog on desktop with backend when helper handoff is local', () => {
    standaloneWithoutBasis.mockReturnValue(false)
    store['morgendrot.handoff.localApplied.v1'] = JSON.stringify({
      savedAtMs: Date.now(),
      role: 'messenger',
      simpleMode: true,
      packageId: '0x' + 'a'.repeat(64),
      mailboxId: '0x' + 'b'.repeat(64),
    })
    expect(isHelperHandoffProfileForSeedSetup(JSON.parse(store['morgendrot.handoff.localApplied.v1']))).toBe(true)
    expect(shouldShowHelperSeedSetupDialog()).toBe(true)
  })
})
