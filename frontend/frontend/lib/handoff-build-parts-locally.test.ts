import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildHandoffPartsLocally } from '@/frontend/lib/handoff-build-parts-locally'
import type { BossHandoffExportContext } from '@/frontend/lib/resolve-boss-handoff-export-context'

vi.mock('@/frontend/lib/handoff-extras', () => ({
  readHandoffExtras: vi.fn(() => null),
}))

const PKG = '0x' + 'a'.repeat(64)
const BOSS = '0x' + 'b'.repeat(64)
const MB = '0x' + 'c'.repeat(64)
const CR = '0x' + 'd'.repeat(64)
const VR = '0x' + 'e'.repeat(64)

const readyContext: BossHandoffExportContext = {
  ready: true,
  missing: [],
  packageId: PKG,
  mailboxId: MB,
  bossAddress: BOSS,
  rpcUrl: 'https://api.testnet.iota.cafe',
  directIotaRpcUrl: 'https://api.testnet.iota.cafe',
  commandRegistryId: CR,
  vaultRegistryId: VR,
  exportTtlDays: 30,
  exportEnablePurge: true,
  einsatzChainMode: 'mainnet-direct',
}

describe('buildHandoffPartsLocally', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns envContent and runtime config when context ready', () => {
    const r = buildHandoffPartsLocally(
      { handoffLabel: 'Test-Einsatz', helperRole: 'messenger' },
      readyContext
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.envContent).toContain(`PACKAGE_ID=${PKG}`)
    expect(r.envContent).toContain(`BOSS_ADDRESS=${BOSS}`)
    expect(r.envContent).toContain(`COMMAND_REGISTRY_ID=${CR}`)
    expect(r.envContent).toContain(`VAULT_REGISTRY_ID=${VR}`)
    expect(r.runtimeConfigContent).toContain('messengerCapabilities')
    expect(r.filenameBase).toMatch(/^morgendrot-standalone-handoff-/)
    expect(r.readme).toContain('Test-Einsatz')
  })

  it('fails when context not ready', () => {
    const r = buildHandoffPartsLocally({}, { ...readyContext, ready: false, missing: ['Mailbox-ID'] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('Mailbox-ID')
  })
})
