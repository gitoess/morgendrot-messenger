import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  applyStandaloneSoloChainConfig,
  getStandaloneSoloChainDefaults,
  pickSoloChainPrefillFromApiStatus,
  SOLO_TESTNET_RPC_URL,
} from './standalone-solo-setup'

const HEX_PKG = `0x${'a'.repeat(64)}`
const HEX_MB = `0x${'b'.repeat(64)}`
const HEX_ADDR = `0x${'c'.repeat(64)}`

vi.mock('@/frontend/lib/standalone-onboarding', () => ({
  isStandaloneSoloPath: () => true,
}))

vi.mock('@/frontend/lib/handoff-standalone-ready', () => ({
  getStandaloneHelperReadiness: vi.fn(),
  notifyStandaloneWalletActivated: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSignerAddress: () => HEX_ADDR,
}))

vi.mock('@/frontend/lib/handoff-local-apply', () => ({
  readLocalHandoffAppliedSnapshot: () => ({ savedAtMs: 1, handoffLabel: 'Solo' }),
  saveLocalHandoffAppliedSnapshot: vi.fn(),
}))

const persistDirectChainFieldIds = vi.fn()
const persistDirectMailboxChainSnapshot = vi.fn()
vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectChainFieldIdsFromLs: () => ({ packageId: '', mailboxId: '', senderAddress: '', ttlDays: 30n }),
  persistDirectChainFieldIds: (...args: unknown[]) => persistDirectChainFieldIds(...args),
  persistDirectMailboxChainSnapshot: (...args: unknown[]) => persistDirectMailboxChainSnapshot(...args),
}))

const writeNetworkProfilesState = vi.fn()
vi.mock('@/frontend/lib/einsatz-network-profiles', () => ({
  readNetworkProfilesState: () => ({
    active: 'testnet',
    testnet: { rpcUrl: '', packageId: '', mailboxId: '' },
    mainnet: { rpcUrl: 'https://api.mainnet.iota.cafe', packageId: '', mailboxId: '' },
  }),
  writeNetworkProfilesState: (...args: unknown[]) => writeNetworkProfilesState(...args),
}))

vi.mock('@/frontend/lib/active-network-chain-sync', () => ({
  syncActiveNetworkChainSnapshot: vi.fn(),
}))

const setBrowserDirectIotaRpcUrlOverride = vi.fn()
vi.mock('@/frontend/lib/direct-iota-rpc', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/frontend/lib/direct-iota-rpc')>()
  return {
    ...mod,
    getConfiguredDirectIotaRpcUrl: () => null,
    setBrowserDirectIotaRpcUrlOverride: (...args: unknown[]) => setBrowserDirectIotaRpcUrlOverride(...args),
  }
})

describe('standalone-solo-setup', () => {
  beforeEach(() => {
    persistDirectChainFieldIds.mockClear()
    persistDirectMailboxChainSnapshot.mockClear()
    setBrowserDirectIotaRpcUrlOverride.mockClear()
    writeNetworkProfilesState.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('liefert Testnet-RPC als Default', () => {
    expect(getStandaloneSoloChainDefaults().rpcUrl).toBe(SOLO_TESTNET_RPC_URL)
  })

  it('übernimmt Package/Mailbox aus API-Status', () => {
    const prefill = pickSoloChainPrefillFromApiStatus({
      packageId: HEX_PKG,
      mailboxId: HEX_MB,
      rpcUrlLabel: 'https://api.testnet.iota.cafe',
    })
    expect(prefill.packageId).toBe(HEX_PKG)
    expect(prefill.mailboxId).toBe(HEX_MB)
    expect(prefill.rpcUrl).toBe('https://api.testnet.iota.cafe')
  })

  it('speichert gültige Solo-Ketten-Konfiguration', () => {
    const result = applyStandaloneSoloChainConfig({
      rpcUrl: SOLO_TESTNET_RPC_URL,
      packageId: HEX_PKG,
      mailboxId: HEX_MB,
    })
    expect(result).toEqual({ ok: true })
    expect(setBrowserDirectIotaRpcUrlOverride).toHaveBeenCalledWith(SOLO_TESTNET_RPC_URL)
    expect(persistDirectChainFieldIds).toHaveBeenCalledWith({
      packageId: HEX_PKG,
      mailboxId: HEX_MB,
      senderAddress: HEX_ADDR,
    })
    expect(persistDirectMailboxChainSnapshot).toHaveBeenCalled()
    expect(writeNetworkProfilesState).toHaveBeenCalled()
    const np = writeNetworkProfilesState.mock.calls[0]?.[0] as {
      active: string
      setupPlan: string
      testnet: { packageId: string }
      mainnet: { packageId: string }
    }
    expect(np.active).toBe('testnet')
    expect(np.setupPlan).toBe('both')
    expect(np.testnet.packageId).toBe(HEX_PKG)
    expect(np.mainnet.packageId).toMatch(/^0x[a-f0-9]{64}$/i)
  })

  it('lehnt ungültige Package-ID ab', () => {
    const result = applyStandaloneSoloChainConfig({
      rpcUrl: SOLO_TESTNET_RPC_URL,
      packageId: 'bad',
      mailboxId: HEX_MB,
    })
    expect(result).toEqual({ ok: false, error: 'invalidPackageId' })
  })
})
