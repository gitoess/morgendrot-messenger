import { beforeEach, describe, expect, it, vi } from 'vitest'

const destroyGuarded = vi.fn()
const destroyBearer = vi.fn()

vi.mock('@/frontend/lib/nft-guarded-purse-actions', () => ({
  destroyEmptyNftGuardedPurse: (...args: unknown[]) => destroyGuarded(...args),
}))
vi.mock('@/frontend/lib/nft-bearer-treasury-actions', () => ({
  destroyEmptyNftBearerTreasury: (...args: unknown[]) => destroyBearer(...args),
}))

import { upsertNftGuardedPurseLocal, removeNftGuardedPurseLocal } from '@/frontend/lib/nft-guarded-purse-local-store'
import { upsertNftBearerTreasuryLocal, removeNftBearerTreasuryLocal } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { autoDestroyEmptyNftVault } from '@/frontend/lib/nft-vault-auto-destroy-empty'

const NFT = '0x' + 'aa'.repeat(32)
const VAULT = '0x' + '11'.repeat(32)

describe('autoDestroyEmptyNftVault', () => {
  beforeEach(() => {
    window.localStorage.clear()
    destroyGuarded.mockReset()
    destroyBearer.mockReset()
    removeNftGuardedPurseLocal(VAULT)
    removeNftBearerTreasuryLocal(VAULT)
  })

  it('skips when mist > 0', async () => {
    upsertNftGuardedPurseLocal({
      purseObjectId: VAULT,
      nftObjectId: NFT,
      owner: '0x' + '00'.repeat(32),
      balanceMistHint: '1',
      status: 'active',
    })
    const r = await autoDestroyEmptyNftVault({ vaultObjectId: VAULT, mist: 1n })
    expect(r).toEqual({ status: 'skipped', reason: 'nonzero' })
    expect(destroyGuarded).not.toHaveBeenCalled()
  })

  it('calls destroy_empty for guarded when mist is 0', async () => {
    upsertNftGuardedPurseLocal({
      purseObjectId: VAULT,
      nftObjectId: NFT,
      owner: '0x' + '00'.repeat(32),
      balanceMistHint: '0',
      status: 'active',
      messagingPackageId: '0x' + '99'.repeat(32),
    })
    destroyGuarded.mockResolvedValue({ ok: true, digest: '0xdigest', purseObjectId: VAULT })
    const r = await autoDestroyEmptyNftVault({ vaultObjectId: VAULT, mist: 0n })
    expect(r).toEqual({ status: 'destroyed', kind: 'guarded', digest: '0xdigest' })
    expect(destroyGuarded).toHaveBeenCalledWith({
      messagingPackageId: '0x' + '99'.repeat(32),
      purseObjectId: VAULT,
    })
    expect(destroyBearer).not.toHaveBeenCalled()
  })

  it('calls destroy_empty for bearer when mist is 0', async () => {
    upsertNftBearerTreasuryLocal({
      treasuryObjectId: VAULT,
      nftObjectId: NFT,
      admin: '0x' + '00'.repeat(32),
      balanceMistHint: '0',
      frozen: false,
      status: 'active',
    })
    destroyBearer.mockResolvedValue({ ok: true, digest: '0xb', treasuryObjectId: VAULT })
    const r = await autoDestroyEmptyNftVault({
      vaultObjectId: VAULT,
      mist: 0n,
      fallbackPackageId: '0x' + '77'.repeat(32),
    })
    expect(r.status).toBe('destroyed')
    expect(destroyBearer).toHaveBeenCalled()
  })

  it('skips without local vault index', async () => {
    const r = await autoDestroyEmptyNftVault({ vaultObjectId: VAULT, mist: 0n })
    expect(r).toEqual({ status: 'skipped', reason: 'no-local-vault' })
  })
})
