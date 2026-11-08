import { describe, expect, it } from 'vitest'
import { parseVaultFromTxPayload } from '@/frontend/lib/nft-vault-recover-from-tx'

const TREASURY = '0x' + '15'.repeat(32)
const NFT = '0x' + '5a'.repeat(32)
const ADMIN = '0x' + '67'.repeat(32)
const PKG = '0x' + '10'.repeat(32)

describe('nft-vault-recover-from-tx', () => {
  it('parst TreasuryCreated Event', () => {
    const v = parseVaultFromTxPayload({
      digest: 'ERp1RAs1jTQK2nKAuLQs8MHxCDqfqxdBpK5tuEz4zaUu',
      events: [
        {
          packageId: PKG,
          type: `${PKG}::nft_bearer_treasury::TreasuryCreated`,
          parsedJson: {
            admin: ADMIN,
            amount: '2000000000',
            required_nft_id: NFT,
            treasury_id: TREASURY,
          },
        },
      ],
    })
    expect(v?.kind).toBe('bearer')
    if (v?.kind === 'bearer') {
      expect(v.treasuryObjectId).toBe(TREASURY)
      expect(v.nftObjectId).toBe(NFT)
      expect(v.amountMist).toBe('2000000000')
      expect(v.messagingPackageId).toBe(PKG)
    }
  })

  it('fällt auf objectChanges zurück', () => {
    const v = parseVaultFromTxPayload({
      digest: 'd',
      objectChanges: [
        {
          type: 'created',
          objectId: TREASURY,
          objectType: `${PKG}::nft_bearer_treasury::NftGuardedTreasury<0x2::iota::IOTA>`,
          sender: ADMIN,
        },
      ],
      sender: ADMIN,
    })
    expect(v?.kind).toBe('bearer')
    if (v?.kind === 'bearer') {
      expect(v.treasuryObjectId).toBe(TREASURY)
      expect(v.messagingPackageId).toBe(PKG)
    }
  })
})
