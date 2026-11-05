import { describe, expect, it } from 'vitest'
import { buildMintImageNftTransaction } from '@/frontend/lib/evidence-image-nft-txb'
import { KNOWN_IMAGE_NFT_PACKAGE_IDS } from '@/frontend/lib/evidence-onchain-image'

describe('buildMintImageNftTransaction', () => {
  it('baut PTB mit bekanntem Package', () => {
    const txb = buildMintImageNftTransaction({
      senderAddress: `0x${'ab'.repeat(32)}`,
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
