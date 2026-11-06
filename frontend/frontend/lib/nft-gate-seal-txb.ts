/**
 * B2-P4b — PTB für seal_approve* (dry_run / Doku / Smoke).
 */

import { Transaction } from '@iota/iota-sdk/transactions'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

function assertHex64(id: string, label: string): string {
  const v = id.trim().toLowerCase()
  if (!HEX64.test(v)) throw new Error(`Ungültige ${label}.`)
  return v
}

function imageNftTypeArg(imageNftPackageId?: string): string {
  const pkg = assertHex64(
    imageNftPackageId || KNOWN_IMAGE_NFT_PACKAGE_IDS[0],
    'ImageNFT-PACKAGE_ID'
  )
  return `${pkg}::image_nft::ImageNFT`
}

/** Identity bytes = 32-byte object id without 0x. */
export function nftSealIdentityBytes(nftObjectId: string): Uint8Array {
  const h = assertHex64(nftObjectId, 'NFT Object-ID').slice(2)
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function buildSealApproveNftOwnerTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  nftObjectId: string
  imageNftPackageId?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const nft = assertHex64(input.nftObjectId, 'NFT Object-ID')
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_gate_seal::seal_approve_nft_owner`,
    typeArguments: [imageNftTypeArg(input.imageNftPackageId)],
    arguments: [txb.pure.vector('u8', Array.from(nftSealIdentityBytes(nft))), txb.object(nft)],
  })
  return txb
}

export function buildSealApproveNftAndWalletTransaction(input: {
  messagingPackageId: string
  senderAddress: string
  nftObjectId: string
  requiredWallet: string
  imageNftPackageId?: string
}): Transaction {
  const pkg = assertHex64(input.messagingPackageId, 'Messaging-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender')
  const nft = assertHex64(input.nftObjectId, 'NFT Object-ID')
  const wallet = assertHex64(input.requiredWallet, 'requiredWallet')
  const txb = new Transaction()
  txb.setSender(sender)
  txb.moveCall({
    target: `${pkg}::nft_gate_seal::seal_approve_nft_and_wallet`,
    typeArguments: [imageNftTypeArg(input.imageNftPackageId)],
    arguments: [
      txb.pure.vector('u8', Array.from(nftSealIdentityBytes(nft))),
      txb.object(nft),
      txb.pure.address(wallet),
    ],
  })
  return txb
}
