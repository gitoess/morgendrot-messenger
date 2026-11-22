import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nftRoleBadgeLabels, nftRoleBadges } from '@/frontend/lib/nft-role-badges'
import { upsertNftGuardedPurseLocal } from '@/frontend/lib/nft-guarded-purse-local-store'
import { upsertNftTimeLeaseLocal } from '@/frontend/lib/nft-time-lease-local-store'
import { writeZeitkapselLastNftObjectId } from '@/frontend/lib/passphrase-message-local-store'

const NFT = `0x${'ab'.repeat(32)}`
const PURSE = `0x${'cd'.repeat(32)}`
const LEASE = `0x${'ef'.repeat(32)}`
const W1 = `0x${'11'.repeat(32)}`
const W2 = `0x${'22'.repeat(32)}`

describe('nftRoleBadges', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('allows multiple orthogonal roles on one NFT', () => {
    upsertNftGuardedPurseLocal({
      purseObjectId: PURSE,
      nftObjectId: NFT,
      owner: W1,
      status: 'active',
      balanceMistHint: '1000',
    })
    upsertNftTimeLeaseLocal({
      leaseObjectId: LEASE,
      nftObjectId: NFT,
      lender: W1,
      borrower: W2,
      unlockMs: Date.now() + 60_000,
      reclaimCancelled: false,
      status: 'active',
    })
    writeZeitkapselLastNftObjectId(NFT)
    const ids = nftRoleBadges(NFT).map((b) => b.id)
    expect(ids).toContain('gesichert')
    expect(ids).toContain('verliehen')
    expect(ids).toContain('leserecht')
    expect(nftRoleBadgeLabels(NFT).join(' · ')).toMatch(/Gesichert/)
  })
})
