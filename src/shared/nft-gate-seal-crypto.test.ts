import { describe, expect, it } from 'vitest'
import {
  deriveNftSealWrapKeyRaw,
  nftObjectIdToIdentityBytes,
  parseNftGateSealMaster,
} from './nft-gate-seal-crypto.js'

const OID = '0x' + 'ab'.repeat(32)
const WALLET = '0x' + 'cd'.repeat(32)

describe('nft-gate-seal-crypto', () => {
  it('identity 32 bytes', () => {
    expect(nftObjectIdToIdentityBytes(OID).length).toBe(32)
  })

  it('derive deterministisch und wallet-gebunden', async () => {
    const master = parseNftGateSealMaster('11'.repeat(32))
    const a = await deriveNftSealWrapKeyRaw(master, OID)
    const b = await deriveNftSealWrapKeyRaw(master, OID)
    const c = await deriveNftSealWrapKeyRaw(master, OID, WALLET)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
    expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false)
    expect(a.length).toBe(32)
  })
})
