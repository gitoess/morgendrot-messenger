/**
 * PTB: `image_nft::mint` — separates Evidenz-Package (nicht messaging).
 */
import { Transaction } from '@iota/iota-sdk/transactions'
import { bcs } from '@iota/iota-sdk/bcs'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BuildMintImageNftTxInput = {
  packageId?: string
  senderAddress: string
  name: string
  description: string
  imageData: Uint8Array
  contentType: string
  createdAtMs: number
  encrypted: boolean
  hashHex: string
  classification: string
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

export function buildMintImageNftTransaction(input: BuildMintImageNftTxInput): Transaction {
  const pkg = (input.packageId || KNOWN_IMAGE_NFT_PACKAGE_IDS[0]).trim().toLowerCase()
  const sender = input.senderAddress.trim().toLowerCase()
  if (!HEX64.test(pkg)) throw new Error('Ungültige ImageNFT-PACKAGE_ID.')
  if (!HEX64.test(sender)) throw new Error('Ungültige Absender-Adresse.')
  if (!input.imageData.length) throw new Error('image_data leer.')

  const txb = new Transaction()
  txb.setSender(sender)
  const v8 = (u8: Uint8Array) => txb.pure(bcs.vector(bcs.u8()).serialize(u8))
  txb.moveCall({
    target: `${pkg}::image_nft::mint`,
    arguments: [
      v8(utf8Bytes(input.name.slice(0, 128))),
      v8(utf8Bytes(input.description.slice(0, 512))),
      v8(input.imageData),
      v8(utf8Bytes(input.contentType.slice(0, 64))),
      txb.pure.u64(BigInt(Math.max(0, Math.floor(input.createdAtMs)))),
      txb.pure(bcs.bool().serialize(Boolean(input.encrypted))),
      v8(utf8Bytes(input.hashHex.slice(0, 128))),
      v8(utf8Bytes(input.classification.slice(0, 64))),
    ],
  })
  return txb
}
