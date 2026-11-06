import { describe, expect, it } from 'vitest'
import {
  buildCancelNftTimeLeaseReclaimTransaction,
  buildCreateNftTimeLeaseTransaction,
  buildReclaimNftTimeLeaseTransaction,
  buildReturnEarlyNftTimeLeaseTransaction,
  IOTA_CLOCK_OBJECT_ID,
  imageNftTypeArg,
} from '@/frontend/lib/nft-time-lease-txb'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'

const MSG = '0x' + '11'.repeat(32)
const NFT = '0x' + '22'.repeat(32)
const LEASE = '0x' + '33'.repeat(32)
const W1 = '0x' + 'aa'.repeat(32)
const W2 = '0x' + 'bb'.repeat(32)

describe('nft-time-lease-txb B2-P5', () => {
  it('imageNftTypeArg', () => {
    expect(imageNftTypeArg()).toContain('::image_nft::ImageNFT')
    expect(imageNftTypeArg(KNOWN_IMAGE_NFT_PACKAGE_IDS[0])).toContain(
      KNOWN_IMAGE_NFT_PACKAGE_IDS[0].toLowerCase()
    )
  })

  it('baut create / cancel / return / reclaim PTBs', () => {
    const create = buildCreateNftTimeLeaseTransaction({
      messagingPackageId: MSG,
      senderAddress: W1,
      nftObjectId: NFT,
      borrowerAddress: W2,
      durationMs: 86_400_000,
    })
    expect(create).toBeTruthy()

    const cancel = buildCancelNftTimeLeaseReclaimTransaction({
      messagingPackageId: MSG,
      senderAddress: W2,
      leaseObjectId: LEASE,
    })
    expect(cancel).toBeTruthy()

    const early = buildReturnEarlyNftTimeLeaseTransaction({
      messagingPackageId: MSG,
      senderAddress: W2,
      leaseObjectId: LEASE,
    })
    expect(early).toBeTruthy()

    const reclaim = buildReclaimNftTimeLeaseTransaction({
      messagingPackageId: MSG,
      senderAddress: W1,
      leaseObjectId: LEASE,
    })
    expect(reclaim).toBeTruthy()
    expect(IOTA_CLOCK_OBJECT_ID).toBe('0x6')
  })
})
