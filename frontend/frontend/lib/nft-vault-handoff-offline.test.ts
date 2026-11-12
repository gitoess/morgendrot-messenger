import { beforeEach, describe, expect, it } from 'vitest'
import {
  encodeNftVaultHandoffCompact,
  parseAnyNftVaultHandoff,
  parseNftVaultHandoffCompact,
  preferOfflineHandoffText,
} from '@/frontend/lib/nft-vault-handoff-offline'
import {
  applyNftVaultHandoff,
  encodeNftVaultHandoff,
  type NftVaultHandoffPack,
} from '@/frontend/lib/nft-vault-handoff'
import { listNftGuardedPursesLocal } from '@/frontend/lib/nft-guarded-purse-local-store'
import { listNftBearerTreasuriesLocal } from '@/frontend/lib/nft-bearer-treasury-local-store'

const pack: NftVaultHandoffPack = {
  v: 1,
  kind: 'bearer',
  nftObjectId: ('0x' + '22'.repeat(32)).toLowerCase(),
  vaultObjectId: ('0x' + '33'.repeat(32)).toLowerCase(),
  createDigest: 'DIGEST123',
  messagingPackageId: ('0x' + '11'.repeat(32)).toLowerCase(),
  displayLabel: 'Test',
}

describe('nft-vault-handoff-offline', () => {
  it('roundtrip compact', () => {
    const c = encodeNftVaultHandoffCompact(pack)
    expect(c.startsWith('MORG_NFT_V1C:')).toBe(true)
    const back = parseNftVaultHandoffCompact(c)
    expect(back?.nftObjectId).toBe(pack.nftObjectId)
    expect(back?.vaultObjectId).toBe(pack.vaultObjectId)
    expect(back?.kind).toBe('bearer')
    expect(back?.createDigest).toBe('DIGEST123')
  })

  it('parseAny akzeptiert JSON und Compact', () => {
    expect(parseAnyNftVaultHandoff(encodeNftVaultHandoff(pack))?.vaultObjectId).toBe(pack.vaultObjectId)
    expect(parseAnyNftVaultHandoff(encodeNftVaultHandoffCompact(pack))?.kind).toBe('bearer')
  })

  it('parseAny liest Compact aus Bundle-Text (mehrzeilig)', () => {
    const { bundle } = preferOfflineHandoffText(pack)
    expect(bundle).toContain('NFT:')
    expect(bundle).toContain('Vault:')
    expect(parseAnyNftVaultHandoff(bundle)?.vaultObjectId).toBe(pack.vaultObjectId)
  })

  it('Empfänger: Compact/Bundle → applyNftVaultHandoff setzt Index (Guarded+Bearer)', () => {
    window.localStorage.clear()
    const guarded: NftVaultHandoffPack = {
      ...pack,
      kind: 'guarded',
      nftObjectId: ('0x' + 'aa'.repeat(32)).toLowerCase(),
      vaultObjectId: ('0x' + 'bb'.repeat(32)).toLowerCase(),
    }
    const compact = encodeNftVaultHandoffCompact(guarded)
    const parsed = parseAnyNftVaultHandoff(compact)
    expect(parsed).toBeTruthy()
    const r = applyNftVaultHandoff(parsed!)
    expect(r.ok).toBe(true)
    expect(
      listNftGuardedPursesLocal().some((p) => p.purseObjectId === guarded.vaultObjectId)
    ).toBe(true)

    const { bundle } = preferOfflineHandoffText(pack)
    const parsedB = parseAnyNftVaultHandoff(bundle)
    expect(parsedB?.kind).toBe('bearer')
    applyNftVaultHandoff(parsedB!)
    expect(
      listNftBearerTreasuriesLocal().some((t) => t.treasuryObjectId === pack.vaultObjectId)
    ).toBe(true)
  })
})
