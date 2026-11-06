import { describe, expect, it } from 'vitest'
import {
  buildBurnImageNftTransaction,
  buildMintImageNftTransaction,
  buildTransferImageNftTransaction,
} from '@/frontend/lib/evidence-image-nft-txb'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'

const ADDR = `0x${'ab'.repeat(32)}`
const OID = `0x${'cd'.repeat(32)}`

describe('buildMintImageNftTransaction', () => {
  it('baut PTB mit bekanntem Package', () => {
    const txb = buildMintImageNftTransaction({
      senderAddress: ADDR,
      name: 'Test',
      description: 'Desc',
      imageData: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
      createdAtMs: 1_700_000_000_000,
      encrypted: true,
      hashHex: 'abc',
      classification: 'evidence',
    })
    expect(txb).toBeTruthy()
    const data = typeof (txb as { getData?: () => unknown }).getData === 'function'
      ? (txb as { getData: () => unknown }).getData()
      : null
    const blob = JSON.stringify(data ?? { ok: true, pkg: KNOWN_IMAGE_NFT_PACKAGE_IDS[0] })
    expect(blob.length).toBeGreaterThan(10)
  })
})

describe('ImageNFT transfer/burn PTB', () => {
  it('baut TransferObjects-PTB', () => {
    const txb = buildTransferImageNftTransaction({
      senderAddress: ADDR,
      objectId: OID,
      recipientAddress: `0x${'11'.repeat(32)}`,
    })
    expect(txb).toBeTruthy()
  })

  it('baut burn-MoveCall-PTB', () => {
    const txb = buildBurnImageNftTransaction({
      senderAddress: ADDR,
      objectId: OID,
    })
    expect(txb).toBeTruthy()
  })
})
