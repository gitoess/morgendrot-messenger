/**
 * B2-S1 — PTB für messaging::nft_guarded_purse (Guarded Purse / Token-2FA).
 * Spec: docs/NFT-GUARDED-SPEND-SPEC.md
 * Package = Messaging-PACKAGE_ID (nach Upgrade mit Modul). Coin-Typ Default: 0x2::iota::IOTA.
 */

import { Transaction } from '@iota/iota-sdk/transactions'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'

export const IOTA_COIN_TYPE = '0x2::iota::IOTA'

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

export function guardedPurseType(messagingPackageId: string, coinType = IOTA_COIN_TYPE): string {
  const pkg = assertHex64(messagingPackageId, 'Messaging-PACKAGE_ID')
  return `${pkg}::nft_guarded_purse::GuardedPurse<${coinType}>`
}

/** X: Coin + gebundenes NFT → neue GuardedPurse owned by X. */
export function buildCreateGuardedPurseTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  nftObjectId: string
  /** Coin-Object-ID oder Gas-Split-Betrag über `splitFromGasMist`. */
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

  let coinArg
  if (input.coinObjectId) {
    coinArg = txb.object(assertHex64(input.coinObjectId, 'Coin Object-ID'))
  } else if (input.splitFromGasMist != null) {
    const mist = BigInt(input.splitFromGasMist)
    if (mist <= 0n) throw new Error('splitFromGasMist muss > 0 sein.')
    ;[coinArg] = txb.splitCoins(txb.gas, [mist])
  } else {
    throw new Error('coinObjectId oder splitFromGasMist erforderlich.')
  }

  txb.moveCall({
    target: `${pkg}::nft_guarded_purse::create_purse`,
    typeArguments: [coinType, imageNftTypeArg(input.imageNftPackageId)],
    arguments: [txb.object(nft), coinArg],
  })
  return txb
}

/** X: weiteres Coin in bestehende Purse. */
export function buildDepositGuardedPurseTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  purseObjectId: string
  coinObjectId?: string
  splitFromGasMist?: bigint | number | string
  coinType?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const purse = assertHex64(input.purseObjectId, 'Purse Object-ID')
  const coinType = (input.coinType || IOTA_COIN_TYPE).trim()
  const txb = new Transaction()
  txb.setSender(sender)

  let coinArg
  if (input.coinObjectId) {
    coinArg = txb.object(assertHex64(input.coinObjectId, 'Coin Object-ID'))
  } else if (input.splitFromGasMist != null) {
    const mist = BigInt(input.splitFromGasMist)
    if (mist <= 0n) throw new Error('splitFromGasMist muss > 0 sein.')
    ;[coinArg] = txb.splitCoins(txb.gas, [mist])
  } else {
    throw new Error('coinObjectId oder splitFromGasMist erforderlich.')
  }

  txb.moveCall({
    target: `${pkg}::nft_guarded_purse::deposit`,
    typeArguments: [coinType],
    arguments: [txb.object(purse), coinArg],
  })
  return txb
}

/** X ∧ NFT: Betrag aus Purse an Empfänger. */
export function buildSpendGuardedPurseTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  purseObjectId: string
  nftObjectId: string
  amountMist: bigint | number | string
  recipientAddress: string
  imageNftPackageId?: string
  coinType?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const purse = assertHex64(input.purseObjectId, 'Purse Object-ID')
  const nft = assertHex64(input.nftObjectId, 'NFT Object-ID')
  const recipient = assertHex64(input.recipientAddress, 'Empfänger')
  const amount = BigInt(input.amountMist)
  if (amount <= 0n) throw new Error('amountMist muss > 0 sein.')
  const coinType = (input.coinType || IOTA_COIN_TYPE).trim()
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_guarded_purse::spend`,
    typeArguments: [coinType, imageNftTypeArg(input.imageNftPackageId)],
    arguments: [
      txb.object(purse),
      txb.object(nft),
      txb.pure.u64(amount),
      txb.pure.address(recipient),
    ],
  })
  return txb
}

/** X: leere Purse zerstören. */
export function buildDestroyEmptyGuardedPurseTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  purseObjectId: string
  coinType?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const purse = assertHex64(input.purseObjectId, 'Purse Object-ID')
  const coinType = (input.coinType || IOTA_COIN_TYPE).trim()
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_guarded_purse::destroy_empty`,
    typeArguments: [coinType],
    arguments: [txb.object(purse)],
  })
  return txb
}
