import { describe, expect, it } from 'vitest'
import {
  encodeNftVaultHandoff,
  nftVaultTransferHint,
  parseNftVaultHandoff,
  type NftVaultHandoffPack,
} from '@/frontend/lib/nft-vault-handoff'

const NFT = '0x' + 'ab'.repeat(32)
const VAULT = '0x' + 'cd'.repeat(32)

describe('nft-vault-handoff', () => {
  it('roundtrips pack', () => {
    const pack: NftVaultHandoffPack = {
      v: 1,
      kind: 'bearer',
      nftObjectId: NFT,
      vaultObjectId: VAULT,
      createDigest: 'DigestABC',
      messagingPackageId: '0x' + '11'.repeat(32),
    }
    const enc = encodeNftVaultHandoff(pack)
    expect(enc.startsWith('MORG_NFT_VAULT_V1:')).toBe(true)
    const back = parseNftVaultHandoff(enc)
    expect(back).toEqual({
      ...pack,
      nftObjectId: NFT.toLowerCase(),
      vaultObjectId: VAULT.toLowerCase(),
      messagingPackageId: ('0x' + '11'.repeat(32)).toLowerCase(),
    })
  })

  it('parses raw JSON without prefix', () => {
    const raw = JSON.stringify({
      v: 1,
      kind: 'guarded',
      nftObjectId: NFT,
      vaultObjectId: VAULT,
    })
    expect(parseNftVaultHandoff(raw)?.kind).toBe('guarded')
  })

  it('hints distinguish bearer vs guarded', () => {
    expect(nftVaultTransferHint('bearer')).toMatch(/Senderecht/)
    expect(nftVaultTransferHint('guarded')).toMatch(/bleiben/)
  })
})
