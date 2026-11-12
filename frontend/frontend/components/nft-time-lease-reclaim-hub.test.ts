import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { countOpenNftTimeLeases } from '@/frontend/components/nft-time-lease-reclaim-hub'
import { upsertNftTimeLeaseLocal } from '@/frontend/lib/nft-time-lease-local-store'

const NFT = `0x${'11'.repeat(32)}`
const LEASE = `0x${'22'.repeat(32)}`
const W1 = `0x${'33'.repeat(32)}`
const W2 = `0x${'44'.repeat(32)}`

describe('countOpenNftTimeLeases', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('zählt nur active, ready nach unlock', () => {
    const now = Date.now()
    upsertNftTimeLeaseLocal({
      leaseObjectId: LEASE,
      nftObjectId: NFT,
      lender: W1,
      borrower: W2,
      unlockMs: now - 1000,
      reclaimCancelled: false,
      status: 'active',
    })
    upsertNftTimeLeaseLocal({
      leaseObjectId: `0x${'55'.repeat(32)}`,
      nftObjectId: `0x${'66'.repeat(32)}`,
      lender: W1,
      borrower: W2,
      unlockMs: now + 60_000,
      reclaimCancelled: false,
      status: 'active',
    })
    upsertNftTimeLeaseLocal({
      leaseObjectId: `0x${'77'.repeat(32)}`,
      nftObjectId: `0x${'88'.repeat(32)}`,
      lender: W1,
      borrower: W2,
      unlockMs: now - 1000,
      reclaimCancelled: false,
      status: 'reclaimed',
    })
    const c = countOpenNftTimeLeases(now)
    expect(c.open).toBe(2)
    expect(c.ready).toBe(1)
  })
})
