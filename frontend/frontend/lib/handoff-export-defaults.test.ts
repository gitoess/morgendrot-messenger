import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/frontend/lib/api/api-base', () => ({
  getApiBase: vi.fn(() => ''),
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectChainFieldIdsFromLs: vi.fn(() => ({
    packageId: '0x' + 'a'.repeat(64),
    mailboxId: '0x' + 'b'.repeat(64),
    senderAddress: '0x' + 'c'.repeat(64),
    ttlDays: 30n,
  })),
}))

vi.mock('@/frontend/lib/direct-iota-rpc', () => ({
  getConfiguredDirectIotaRpcUrl: vi.fn(() => 'https://api.testnet.iota.cafe'),
}))

import { getApiBase } from '@/frontend/lib/api/api-base'
import { fetchHandoffCurrentIdsDefaults } from '@/frontend/lib/handoff-export-defaults'
import { persistBossChainRegistryIds } from '@/frontend/lib/boss-chain-registry-store'

const CR = '0x' + 'c'.repeat(64)
const VR = '0x' + 'f'.repeat(64)

describe('fetchHandoffCurrentIdsDefaults offline', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getApiBase).mockReturnValue('')
  })

  it('liefert Registry-IDs aus localStorage', async () => {
    persistBossChainRegistryIds({ commandRegistryId: CR, vaultRegistryId: VR })
    const patch = await fetchHandoffCurrentIdsDefaults()
    expect(patch.handoffCmdReg).toBe(CR)
    expect(patch.handoffVaultReg).toBe(VR)
    expect(patch.handoffMailbox).toBe('0x' + 'b'.repeat(64))
    expect(patch.handoffRpc).toBe('https://api.testnet.iota.cafe')
  })
})
