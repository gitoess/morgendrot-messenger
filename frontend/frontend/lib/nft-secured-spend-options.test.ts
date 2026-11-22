import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildOwnedNftPickOptions,
  buildSecuredSpendOptions,
  inferSpendModeForNft,
  nftHasFundedSecuredBalance,
  vaultMistHintLooksEmpty,
} from '@/frontend/lib/nft-secured-spend-options'
import { upsertNftBearerTreasuryLocal } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { upsertNftGuardedPurseLocal } from '@/frontend/lib/nft-guarded-purse-local-store'
import { upsertParkedNftVault } from '@/frontend/lib/nft-vault-parked-store'

const A = '0x' + 'aa'.repeat(32)
const B = '0x' + 'bb'.repeat(32)
const C = '0x' + 'cc'.repeat(32)
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
    expect(opts.find((o) => o.objectId === A)?.label).toContain('Guthaben')
    expect(opts.find((o) => o.objectId === A)?.label).not.toMatch(/Bearer|Guarded/i)
    expect(inferSpendModeForNft(A)).toBe('bearer')
    expect(inferSpendModeForNft(B)).toBe('guarded')
  })

  it('guthaben pick shows only free owned NFTs', () => {
    upsertNftGuardedPurseLocal({
      purseObjectId: VA,
      nftObjectId: A,
      owner: '0x' + '00'.repeat(32),
      balanceMistHint: '5000',
      status: 'active',
    })
    upsertNftGuardedPurseLocal({
      purseObjectId: VB,
      nftObjectId: B,
      owner: '0x' + '00'.repeat(32),
      balanceMistHint: '0',
      status: 'active',
      displayLabel: 'Leer',
    })
    const free = buildOwnedNftPickOptions({
      ownedObjectIds: [A, B, C],
      purpose: 'guthaben',
      labelsById: { [C]: 'Frei C' },
    })
    expect(free.map((o) => o.objectId).sort()).toEqual([B, C].sort())
    expect(nftHasFundedSecuredBalance(A)).toBe(true)
    expect(free.find((o) => o.objectId === C)?.label).toContain('Frei C')
    expect(free.every((o) => !o.label.includes('Guthaben'))).toBe(true)
  })

  it('labels empty vaults as plain NFT in broad list', () => {
    upsertNftGuardedPurseLocal({
      purseObjectId: VA,
      nftObjectId: A,
      owner: '0x' + '00'.repeat(32),
      balanceMistHint: '0',
      status: 'active',
      displayLabel: 'Team Nord',
    })
    const opt = buildSecuredSpendOptions().find((o) => o.objectId === A)
    expect(opt?.label).toBe(`Team Nord · ${A.slice(0, 8)}…${A.slice(-4)}`)
    expect(opt?.label).not.toContain('Guthaben')
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

  it('detects empty mist hints', () => {
    expect(vaultMistHintLooksEmpty('0')).toBe(true)
    expect(vaultMistHintLooksEmpty('0 (reclaimed)')).toBe(true)
    expect(vaultMistHintLooksEmpty('1000')).toBe(false)
    expect(vaultMistHintLooksEmpty('?')).toBe(false)
  })
})
