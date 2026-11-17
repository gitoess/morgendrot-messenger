import { afterEach, describe, expect, it } from 'vitest'
import {
  evaluateNftGateAppAccess,
  findNftTimeLeaseByNft,
  isNftTimeLeaseBorrowerActive,
  listNftTimeLeasesLocal,
  nftTimeLeaseBadgeText,
  upsertNftTimeLeaseLocal,
} from '@/frontend/lib/nft-time-lease-local-store'

const LEASE = '0x' + '33'.repeat(32)
const NFT = '0x' + '22'.repeat(32)
const W1 = '0x' + 'aa'.repeat(32)
const W2 = '0x' + 'bb'.repeat(32)

describe('nft-time-lease-local-store B2-P5b', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('upsert + badge + borrower', () => {
    const unlock = Date.now() + 3_600_000
    upsertNftTimeLeaseLocal({
      leaseObjectId: LEASE,
      nftObjectId: NFT,
      lender: W1,
      borrower: W2,
      unlockMs: unlock,
      reclaimCancelled: false,
      status: 'active',
    })
    expect(listNftTimeLeasesLocal()).toHaveLength(1)
    expect(findNftTimeLeaseByNft(NFT)?.leaseObjectId).toBe(LEASE.toLowerCase())
    expect(isNftTimeLeaseBorrowerActive(findNftTimeLeaseByNft(NFT), W2)).toBe(true)
    expect(isNftTimeLeaseBorrowerActive(findNftTimeLeaseByNft(NFT), W1)).toBe(false)
    const badge = nftTimeLeaseBadgeText(findNftTimeLeaseByNft(NFT)!)
    expect(badge).toMatch(/Leihe aktiv|nur Empfänger-Wallet|Borrower/)
    const lease = findNftTimeLeaseByNft(NFT)
    expect(
      evaluateNftGateAppAccess({ signerAddress: W1, addressOwned: true, lease }).ok
    ).toBe(false)
    expect(
      evaluateNftGateAppAccess({ signerAddress: W1, addressOwned: true, lease }).lenderBlocked
    ).toBe(true)
    expect(
      evaluateNftGateAppAccess({ signerAddress: W2, addressOwned: false, lease }).ok
    ).toBe(true)
    expect(
      evaluateNftGateAppAccess({ signerAddress: W1, addressOwned: true, lease: null }).ok
    ).toBe(true)
  })
})
