import { describe, expect, it } from 'vitest'
import {
  buildSealApproveNftAndWalletTransaction,
  buildSealApproveNftOwnerTransaction,
  nftSealIdentityBytes,
} from '@/frontend/lib/nft-gate-seal-txb'

const MSG = '0x' + '11'.repeat(32)
const NFT = '0x' + '22'.repeat(32)
const W1 = '0x' + 'aa'.repeat(32)

describe('nft-gate-seal-txb B2-P4b', () => {
  it('identity bytes 32', () => {
    expect(nftSealIdentityBytes(NFT).length).toBe(32)
  })

  it('baut seal_approve PTBs', () => {
    expect(
      buildSealApproveNftOwnerTransaction({
        messagingPackageId: MSG,
        senderAddress: W1,
        nftObjectId: NFT,
      })
    ).toBeTruthy()
    expect(
      buildSealApproveNftAndWalletTransaction({
        messagingPackageId: MSG,
        senderAddress: W1,
        nftObjectId: NFT,
        requiredWallet: W1,
      })
    ).toBeTruthy()
  })
})
