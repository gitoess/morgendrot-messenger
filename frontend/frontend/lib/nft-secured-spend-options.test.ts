import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildSecuredSpendOptions,
  inferSpendModeForNft,
} from '@/frontend/lib/nft-secured-spend-options'
import { upsertNftBearerTreasuryLocal } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { upsertNftGuardedPurseLocal } from '@/frontend/lib/nft-guarded-purse-local-store'
import { upsertParkedNftVault } from '@/frontend/lib/nft-vault-parked-store'

const A = '0x' + 'aa'.repeat(32)
const B = '0x' + 'bb'.repeat(32)
const VA = '0x' + '11'.repeat(32)
const VB = '0x' + '22'.repeat(32)

describe('nft-secured-spend-options', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('lists bearer + parked NFTs and infers bearer mode', () => {
    upsertNftBearerTreasuryLocal({
      treasuryObjectId: VA,
      nftObjectId: A,
      admin: '0x' + '00'.repeat(32),
      balanceMistHint: '1',
      frozen: false,
      status: 'active',
      displayLabel: 'Karte A',
    })
    upsertParkedNftVault({
      nftObjectId: B,
      kind: 'guarded',
      vaultObjectId: VB,
      parkedAtMs: Date.now(),
      displayLabel: 'Karte B',
    })
    const opts = buildSecuredSpendOptions()
    expect(opts.map((o) => o.objectId).sort()).toEqual([A, B].sort())
    expect(inferSpendModeForNft(A)).toBe('bearer')
    expect(inferSpendModeForNft(B)).toBe('guarded')
  })

  it('prefers guarded when both exist', () => {
    upsertNftGuardedPurseLocal({
      purseObjectId: VA,
      nftObjectId: A,
      owner: '0x' + '00'.repeat(32),
      balanceMistHint: '1',
      status: 'active',
    })
    upsertNftBearerTreasuryLocal({
      treasuryObjectId: VB,
      nftObjectId: A,
      admin: '0x' + '00'.repeat(32),
      balanceMistHint: '1',
      frozen: false,
      status: 'active',
    })
    expect(inferSpendModeForNft(A)).toBe('guarded')
  })
})
