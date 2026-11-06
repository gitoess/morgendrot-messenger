/**
 * B2-S3 — PTB für messaging::nft_bearer_treasury (Bearer Treasury / Modus B).
 * Spec: docs/NFT-GUARDED-SPEND-SPEC.md §3
 */

import { Transaction } from '@iota/iota-sdk/transactions'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'
import { IOTA_COIN_TYPE } from '@/frontend/lib/nft-guarded-purse-txb'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

function assertHex64(id: string, label: string): string {
  const v = id.trim().toLowerCase()
  if (!HEX64.test(v)) throw new Error(`Ungültige ${label}.`)
  return v
}

export function imageNftTypeArg(imageNftPackageId?: string): string {
  const pkg = assertHex64(
    imageNftPackageId || KNOWN_IMAGE_NFT_PACKAGE_IDS[0],
    'ImageNFT-PACKAGE_ID'
  )
  return `${pkg}::image_nft::ImageNFT`
}

function coinArg(
  txb: Transaction,
  input: { coinObjectId?: string; splitFromGasMist?: bigint | number | string }
) {
  if (input.coinObjectId) {
    return txb.object(assertHex64(input.coinObjectId, 'Coin Object-ID'))
  }
  if (input.splitFromGasMist != null) {
    const mist = BigInt(input.splitFromGasMist)
    if (mist <= 0n) throw new Error('splitFromGasMist muss > 0 sein.')
    const [c] = txb.splitCoins(txb.gas, [mist])
    return c
  }
  throw new Error('coinObjectId oder splitFromGasMist erforderlich.')
}

export function buildCreateBearerTreasuryTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  nftObjectId: string
  coinObjectId?: string
  splitFromGasMist?: bigint | number | string
  imageNftPackageId?: string
  coinType?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const nft = assertHex64(input.nftObjectId, 'NFT Object-ID')
  const coinType = (input.coinType || IOTA_COIN_TYPE).trim()
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_bearer_treasury::create_treasury`,
    typeArguments: [coinType, imageNftTypeArg(input.imageNftPackageId)],
    arguments: [txb.object(nft), coinArg(txb, input)],
  })
  return txb
}

export function buildDepositBearerTreasuryTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  treasuryObjectId: string
  coinObjectId?: string
  splitFromGasMist?: bigint | number | string
  coinType?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const treasury = assertHex64(input.treasuryObjectId, 'Treasury Object-ID')
  const coinType = (input.coinType || IOTA_COIN_TYPE).trim()
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_bearer_treasury::deposit`,
    typeArguments: [coinType],
    arguments: [txb.object(treasury), coinArg(txb, input)],
  })
  return txb
}

export function buildWithdrawBearerTreasuryTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  treasuryObjectId: string
  nftObjectId: string
  amountMist: bigint | number | string
  recipientAddress: string
  imageNftPackageId?: string
  coinType?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const treasury = assertHex64(input.treasuryObjectId, 'Treasury Object-ID')
  const nft = assertHex64(input.nftObjectId, 'NFT Object-ID')
  const recipient = assertHex64(input.recipientAddress, 'Empfänger')
  const amount = BigInt(input.amountMist)
  if (amount <= 0n) throw new Error('amountMist muss > 0 sein.')
  const coinType = (input.coinType || IOTA_COIN_TYPE).trim()
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_bearer_treasury::withdraw`,
    typeArguments: [coinType, imageNftTypeArg(input.imageNftPackageId)],
    arguments: [
      txb.object(treasury),
      txb.object(nft),
      txb.pure.u64(amount),
      txb.pure.address(recipient),
    ],
  })
  return txb
}

export function buildAdminSetFrozenBearerTreasuryTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  treasuryObjectId: string
  frozen: boolean
  coinType?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const treasury = assertHex64(input.treasuryObjectId, 'Treasury Object-ID')
  const coinType = (input.coinType || IOTA_COIN_TYPE).trim()
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_bearer_treasury::admin_set_frozen`,
    typeArguments: [coinType],
    arguments: [txb.object(treasury), txb.pure.bool(input.frozen)],
  })
  return txb
}

export function buildAdminReclaimBearerTreasuryTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  treasuryObjectId: string
  coinType?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const treasury = assertHex64(input.treasuryObjectId, 'Treasury Object-ID')
  const coinType = (input.coinType || IOTA_COIN_TYPE).trim()
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_bearer_treasury::admin_reclaim`,
    typeArguments: [coinType],
    arguments: [txb.object(treasury)],
  })
  return txb
}
