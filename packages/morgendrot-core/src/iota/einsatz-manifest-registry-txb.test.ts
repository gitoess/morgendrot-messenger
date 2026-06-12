import { describe, expect, it } from 'vitest'
import { buildCreateEinsatzManifestRegistryTransaction } from './einsatz-manifest-registry-txb'

const PKG = '0x' + 'a'.repeat(64)
const SENDER = '0x' + 'b'.repeat(64)
const BOSS = '0x' + 'c'.repeat(64)

describe('buildCreateEinsatzManifestRegistryTransaction', () => {
  it('baut PTB ohne Throw', () => {
    const txb = buildCreateEinsatzManifestRegistryTransaction({
      packageId: PKG,
      senderAddress: SENDER,
      authorizedAnchorer: BOSS,
    })
    expect(txb).toBeDefined()
  })
})
