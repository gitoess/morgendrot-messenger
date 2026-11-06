/**
 * B2-P5a/b — PTB für messaging::nft_time_lease.
 * Package = Messaging-PACKAGE_ID (nach Publish mit Modul). Clock = 0x6.
 */

import { Transaction } from '@iota/iota-sdk/transactions'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'

export const IOTA_CLOCK_OBJECT_ID = '0x6'

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

/** W1: NFT in Escrow-Lease; duration_ms ab Chain-Clock. */
export function buildCreateNftTimeLeaseTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  nftObjectId: string
  borrowerAddress: string
  durationMs: number
  imageNftPackageId?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const nft = assertHex64(input.nftObjectId, 'NFT Object-ID')
  const borrower = assertHex64(input.borrowerAddress, 'Borrower')
  const duration = Math.max(1, Math.floor(input.durationMs))
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_time_lease::create_lease`,
    typeArguments: [imageNftTypeArg(input.imageNftPackageId)],
    arguments: [
      txb.object(nft),
      txb.pure.address(borrower),
      txb.pure.u64(BigInt(duration)),
      txb.object(IOTA_CLOCK_OBJECT_ID),
    ],
  })
  return txb
}

export function buildCancelNftTimeLeaseReclaimTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  leaseObjectId: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const lease = assertHex64(input.leaseObjectId, 'Lease Object-ID')
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_time_lease::cancel_reclaim`,
    arguments: [txb.object(lease)],
  })
  return txb
}

export function buildReturnEarlyNftTimeLeaseTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  leaseObjectId: string
  imageNftPackageId?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const lease = assertHex64(input.leaseObjectId, 'Lease Object-ID')
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_time_lease::return_early`,
    typeArguments: [imageNftTypeArg(input.imageNftPackageId)],
    arguments: [txb.object(lease)],
  })
  return txb
}

export function buildReclaimNftTimeLeaseTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  leaseObjectId: string
  imageNftPackageId?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const lease = assertHex64(input.leaseObjectId, 'Lease Object-ID')
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_time_lease::reclaim`,
    typeArguments: [imageNftTypeArg(input.imageNftPackageId)],
    arguments: [txb.object(lease), txb.object(IOTA_CLOCK_OBJECT_ID)],
  })
  return txb
}
