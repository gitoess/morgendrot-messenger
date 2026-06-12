import { describe, expect, it } from 'vitest'
import { buildStoreEinsatzManifestTransaction } from './einsatz-manifest-txb'

const PKG = '0x' + 'a'.repeat(64)
const REG = '0x' + 'b'.repeat(64)
const SENDER = '0x' + 'c'.repeat(64)
const EINSATZ = '0x' + 'd'.repeat(64)
const HASH = 'e'.repeat(64)
const ROOT = 'f'.repeat(64)

describe('buildStoreEinsatzManifestTransaction', () => {
  it('baut PTB ohne Throw', () => {
    const txb = buildStoreEinsatzManifestTransaction({
      packageId: PKG,
      registryObjectId: REG,
      senderAddress: SENDER,
      einsatzIdMoveAddress: EINSATZ,
      sequence: 1n,
      manifestHashHex: HASH,
      merkleRootHex: ROOT,
      sourceNetwork: 1,
      sourcePackageId: PKG,
      periodStartMs: 1000n,
      periodEndMs: 2000n,
      messageCount: 3n,
    })
    expect(txb).toBeDefined()
  })
})
