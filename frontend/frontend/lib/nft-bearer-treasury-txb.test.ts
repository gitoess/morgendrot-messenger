import { describe, expect, it } from 'vitest'
import {
  buildAdminReclaimBearerTreasuryTransaction,
  buildAdminSetFrozenBearerTreasuryTransaction,
  buildCreateBearerTreasuryTransaction,
  buildDepositBearerTreasuryTransaction,
  buildDestroyEmptyBearerTreasuryTransaction,
  buildWithdrawBearerTreasuryTransaction,
} from '@/frontend/lib/nft-bearer-treasury-txb'

const MSG = '0x' + '11'.repeat(32)
const NFT = '0x' + '22'.repeat(32)
const TREASURY = '0x' + '33'.repeat(32)
const W1 = '0x' + 'aa'.repeat(32)
const W2 = '0x' + 'bb'.repeat(32)

describe('nft-bearer-treasury-txb B2-S3', () => {
  it('baut create / deposit / withdraw / freeze / reclaim PTBs', () => {
    expect(
      buildCreateBearerTreasuryTransaction({
        messagingPackageId: MSG,
        senderAddress: W1,
        nftObjectId: NFT,
        splitFromGasMist: 1_000_000n,
      })
    ).toBeTruthy()

    expect(
      buildDepositBearerTreasuryTransaction({
        messagingPackageId: MSG,
        senderAddress: W2,
        treasuryObjectId: TREASURY,
        splitFromGasMist: 1000,
      })
    ).toBeTruthy()

    expect(
      buildWithdrawBearerTreasuryTransaction({
        messagingPackageId: MSG,
        senderAddress: W2,
        treasuryObjectId: TREASURY,
        nftObjectId: NFT,
        amountMist: 500n,
        recipientAddress: W2,
      })
    ).toBeTruthy()

    expect(
      buildAdminSetFrozenBearerTreasuryTransaction({
        messagingPackageId: MSG,
        senderAddress: W1,
        treasuryObjectId: TREASURY,
        frozen: true,
      })
    ).toBeTruthy()

    expect(
      buildAdminReclaimBearerTreasuryTransaction({
        messagingPackageId: MSG,
        senderAddress: W1,
        treasuryObjectId: TREASURY,
      })
    ).toBeTruthy()

    expect(
      buildDestroyEmptyBearerTreasuryTransaction({
        messagingPackageId: MSG,
        senderAddress: W1,
        treasuryObjectId: TREASURY,
      })
    ).toBeTruthy()
  })

  it('lehnt amount 0 ab', () => {
    expect(() =>
      buildWithdrawBearerTreasuryTransaction({
        messagingPackageId: MSG,
        senderAddress: W1,
        treasuryObjectId: TREASURY,
        nftObjectId: NFT,
        amountMist: 0,
        recipientAddress: W2,
      })
    ).toThrow(/amountMist/)
  })
})
