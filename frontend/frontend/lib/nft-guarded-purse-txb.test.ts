import { describe, expect, it } from 'vitest'
import {
  buildCreateGuardedPurseTransaction,
  buildDepositGuardedPurseTransaction,
  buildDestroyEmptyGuardedPurseTransaction,
  buildSpendGuardedPurseTransaction,
  guardedPurseType,
  IOTA_COIN_TYPE,
  imageNftTypeArg,
} from '@/frontend/lib/nft-guarded-purse-txb'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'

const MSG = '0x' + '11'.repeat(32)
const NFT = '0x' + '22'.repeat(32)
const PURSE = '0x' + '33'.repeat(32)
const COIN = '0x' + '44'.repeat(32)
const W1 = '0x' + 'aa'.repeat(32)
const W2 = '0x' + 'bb'.repeat(32)

describe('nft-guarded-purse-txb B2-S1', () => {
  it('imageNftTypeArg + guardedPurseType', () => {
    expect(imageNftTypeArg()).toContain('::image_nft::ImageNFT')
    expect(imageNftTypeArg(KNOWN_IMAGE_NFT_PACKAGE_IDS[0])).toContain(
      KNOWN_IMAGE_NFT_PACKAGE_IDS[0].toLowerCase()
    )
    expect(guardedPurseType(MSG)).toBe(`${MSG}::nft_guarded_purse::GuardedPurse<${IOTA_COIN_TYPE}>`)
  })

  it('baut create / deposit / spend / destroy PTBs', () => {
    const create = buildCreateGuardedPurseTransaction({
      messagingPackageId: MSG,
      senderAddress: W1,
      nftObjectId: NFT,
      splitFromGasMist: 1_000_000n,
    })
    expect(create).toBeTruthy()

    const createCoin = buildCreateGuardedPurseTransaction({
      messagingPackageId: MSG,
      senderAddress: W1,
      nftObjectId: NFT,
      coinObjectId: COIN,
    })
    expect(createCoin).toBeTruthy()

    const deposit = buildDepositGuardedPurseTransaction({
      messagingPackageId: MSG,
      senderAddress: W1,
      purseObjectId: PURSE,
      splitFromGasMist: 500_000,
    })
    expect(deposit).toBeTruthy()

    const spend = buildSpendGuardedPurseTransaction({
      messagingPackageId: MSG,
      senderAddress: W1,
      purseObjectId: PURSE,
      nftObjectId: NFT,
      amountMist: 100_000n,
      recipientAddress: W2,
    })
    expect(spend).toBeTruthy()

    const destroy = buildDestroyEmptyGuardedPurseTransaction({
      messagingPackageId: MSG,
      senderAddress: W1,
      purseObjectId: PURSE,
    })
    expect(destroy).toBeTruthy()
  })

  it('lehnt ungültige Beträge / fehlende Coin-Quelle ab', () => {
    expect(() =>
      buildCreateGuardedPurseTransaction({
        messagingPackageId: MSG,
        senderAddress: W1,
        nftObjectId: NFT,
      })
    ).toThrow(/coinObjectId oder splitFromGasMist/)

    expect(() =>
      buildSpendGuardedPurseTransaction({
        messagingPackageId: MSG,
        senderAddress: W1,
        purseObjectId: PURSE,
        nftObjectId: NFT,
        amountMist: 0,
        recipientAddress: W2,
      })
    ).toThrow(/amountMist/)
  })
})
