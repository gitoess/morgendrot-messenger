/**
 * PTB: `image_nft::mint` / Transfer / `burn` — separates Evidenz-Package (nicht messaging).
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

function assertHex64(id: string, label: string): string {
  const v = id.trim().toLowerCase()
  if (!HEX64.test(v)) throw new Error(`Ungültige ${label}.`)
  return v
}

export function buildMintImageNftTransaction(input: BuildMintImageNftTxInput): Transaction {
  const pkg = assertHex64(input.packageId || KNOWN_IMAGE_NFT_PACKAGE_IDS[0], 'ImageNFT-PACKAGE_ID')
  const sender = assertHex64(input.senderAddress, 'Absender-Adresse')
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

/** Besitz an Adresse übertragen (PTB TransferObjects — braucht `store` am ImageNFT). */
export function buildTransferImageNftTransaction(input: {
  senderAddress: string
  objectId: string
  recipientAddress: string
}): Transaction {
  const sender = assertHex64(input.senderAddress, 'Absender-Adresse')
  const objectId = assertHex64(input.objectId, 'Object-ID')
  const recipient = assertHex64(input.recipientAddress, 'Empfänger-Adresse')
  const txb = new Transaction()
  txb.setSender(sender)
  txb.transferObjects([txb.object(objectId)], recipient)
  return txb
}

/** Burn-Call an bestehende PTB anhängen (z. B. nach Guarded-Spend in derselben TX). */
export function appendBurnImageNftCall(
  txb: Transaction,
  input: { objectId: string; packageId?: string }
): void {
  const pkg = assertHex64(input.packageId || KNOWN_IMAGE_NFT_PACKAGE_IDS[0], 'ImageNFT-PACKAGE_ID')
  const objectId = assertHex64(input.objectId, 'Object-ID')
  txb.moveCall({
    target: `${pkg}::image_nft::burn`,
    arguments: [txb.object(objectId)],
  })
}

/** On-chain vernichten (`image_nft::burn`) — Storage-Rebate an Absender. */
export function buildBurnImageNftTransaction(input: {
  senderAddress: string
  objectId: string
  packageId?: string
}): Transaction {
  const sender = assertHex64(input.senderAddress, 'Absender-Adresse')
  const txb = new Transaction()
  txb.setSender(sender)
  appendBurnImageNftCall(txb, input)
  return txb
}
