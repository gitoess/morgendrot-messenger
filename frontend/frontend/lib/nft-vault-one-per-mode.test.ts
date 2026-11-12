import { beforeEach, describe, expect, it, vi } from 'vitest'

const NFT = ('0x' + '22'.repeat(32)).toLowerCase()
const PURSE = ('0x' + '33'.repeat(32)).toLowerCase()
const TREASURY = ('0x' + '44'.repeat(32)).toLowerCase()

vi.mock('@/frontend/lib/nft-vault-discover-onchain', () => ({
  syncDiscoveredVaultsIntoLocalIndex: vi.fn().mockResolvedValue({ ok: true, guarded: 0, bearer: 0 }),
}))

describe('nft-vault-one-per-mode', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('blockiert zweites Guarded-Create wenn Index schon Purse hat', async () => {
    const { upsertNftGuardedPurseLocal } = await import('@/frontend/lib/nft-guarded-purse-local-store')
    const { assertCanCreateVaultForNftMode, findExistingVaultForNftMode } = await import(
      '@/frontend/lib/nft-vault-one-per-mode'
    )
    upsertNftGuardedPurseLocal({
      purseObjectId: PURSE,
      nftObjectId: NFT,
      owner: '0x' + 'aa'.repeat(32),
      balanceMistHint: '1',
      status: 'active',
    })
    const found = findExistingVaultForNftMode(NFT, 'guarded')
    expect(found?.vaultObjectId).toBe(PURSE)
    expect(found?.source).toBe('index')
    const gate = assertCanCreateVaultForNftMode(NFT, 'guarded')
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.error).toMatch(/Bereits eine Guarded-Purse/)
    expect(assertCanCreateVaultForNftMode(NFT, 'bearer').ok).toBe(true)
  })

  it('erlaubt Bearer parallel zu Guarded', async () => {
    const { upsertNftGuardedPurseLocal } = await import('@/frontend/lib/nft-guarded-purse-local-store')
    const { upsertNftBearerTreasuryLocal } = await import(
      '@/frontend/lib/nft-bearer-treasury-local-store'
    )
    const { assertCanCreateVaultForNftMode } = await import('@/frontend/lib/nft-vault-one-per-mode')
    upsertNftGuardedPurseLocal({
      purseObjectId: PURSE,
      nftObjectId: NFT,
      owner: '0x' + 'aa'.repeat(32),
      balanceMistHint: '1',
      status: 'active',
    })
    expect(assertCanCreateVaultForNftMode(NFT, 'bearer').ok).toBe(true)
    upsertNftBearerTreasuryLocal({
      treasuryObjectId: TREASURY,
      nftObjectId: NFT,
      admin: '0x' + 'aa'.repeat(32),
      balanceMistHint: '1',
      frozen: false,
      status: 'active',
    })
    expect(assertCanCreateVaultForNftMode(NFT, 'bearer').ok).toBe(false)
  })

  it('assertCanCreateVaultForNftModeWithDiscover zieht Discovery nach', async () => {
    const discover = await import('@/frontend/lib/nft-vault-discover-onchain')
    const { assertCanCreateVaultForNftModeWithDiscover } = await import(
      '@/frontend/lib/nft-vault-one-per-mode'
    )
    const r = await assertCanCreateVaultForNftModeWithDiscover(NFT, 'guarded')
    expect(r.ok).toBe(true)
    expect(discover.syncDiscoveredVaultsIntoLocalIndex).toHaveBeenCalled()
  })
})
