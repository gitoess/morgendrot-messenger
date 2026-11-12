import { beforeEach, describe, expect, it } from 'vitest'
import {
  noteNftNoLongerOwned,
  listNftOwnedSnapshot,
  syncNftOwnedSnapshotAndDetectReceived,
  clearNftActivity,
} from '@/frontend/lib/nft-activity-local-log'
import {
  upsertNftBearerTreasuryLocal,
  listNftBearerTreasuriesLocal,
  NFT_BEARER_TREASURY_LS_KEY,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  parkLocalVaultIndexForNft,
  restoreParkedVaultsForOwnedNfts,
} from '@/frontend/lib/nft-vault-local-clear'
import { listParkedNftVaults, NFT_VAULT_PARKED_LS_KEY } from '@/frontend/lib/nft-vault-parked-store'

const NFT = '0x' + 'ab'.repeat(32)
const VAULT = '0x' + 'cd'.repeat(32)

describe('nft vault park/restore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearNftActivity()
  })

  it('parks treasury on send and restores when NFT owned again', () => {
    upsertNftBearerTreasuryLocal({
      treasuryObjectId: VAULT,
      nftObjectId: NFT,
      admin: '0x' + '11'.repeat(32),
      balanceMistHint: '1000000000',
      frozen: false,
      status: 'active',
      createDigest: 'Dig1',
    })
    syncNftOwnedSnapshotAndDetectReceived([NFT])
    expect(listNftOwnedSnapshot()).toContain(NFT)

    const parked = parkLocalVaultIndexForNft(NFT)
    expect(parked.parkedBearer).toBe(1)
    expect(listNftBearerTreasuriesLocal().filter((t) => t.status === 'active')).toHaveLength(0)
    expect(listParkedNftVaults()[0]?.vaultObjectId).toBe(VAULT)
    expect(listNftOwnedSnapshot()).not.toContain(NFT)

    const back = restoreParkedVaultsForOwnedNfts([NFT])
    expect(back.restored).toBe(1)
    expect(listNftBearerTreasuriesLocal().some((t) => t.treasuryObjectId === VAULT)).toBe(true)
    expect(listParkedNftVaults()).toHaveLength(0)
  })

  it('detects received after noteNftNoLongerOwned', () => {
    syncNftOwnedSnapshotAndDetectReceived([NFT])
    noteNftNoLongerOwned(NFT)
    const got = syncNftOwnedSnapshotAndDetectReceived([NFT], { [NFT]: 'Karte' })
    expect(got).toHaveLength(1)
    expect(got[0]?.kind).toBe('received')
  })

  it('keeps parked key in LS', () => {
    upsertNftBearerTreasuryLocal({
      treasuryObjectId: VAULT,
      nftObjectId: NFT,
      admin: '0x' + '11'.repeat(32),
      balanceMistHint: '?',
      frozen: false,
      status: 'active',
    })
    parkLocalVaultIndexForNft(NFT)
    expect(window.localStorage.getItem(NFT_VAULT_PARKED_LS_KEY)).toContain(VAULT)
    expect(window.localStorage.getItem(NFT_BEARER_TREASURY_LS_KEY) || '').not.toContain(
      '"status":"active"'
    )
  })
})
