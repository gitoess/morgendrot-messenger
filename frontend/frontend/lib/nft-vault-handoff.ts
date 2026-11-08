/**
 * TBA-ähnlich: Vault-Metadaten mit dem NFT teilen (Digest, Vault-ID, Modus).
 * On-chain Balance ist Wahrheit; ohne Index sieht der Empfänger nichts in der App.
 */

import { bindVaultToNftKeycard, getNftKeycard, type NftKeycardBoundVault } from '@/frontend/lib/nft-keycard-local-store'
import {
  findNftBearerTreasuryByNft,
  upsertNftBearerTreasuryLocal,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  findNftGuardedPurseByNft,
  upsertNftGuardedPurseLocal,
} from '@/frontend/lib/nft-guarded-purse-local-store'

export const NFT_VAULT_HANDOFF_PREFIX = 'MORG_NFT_VAULT_V1:'

export type NftVaultHandoffPack = {
  v: 1
  kind: 'bearer' | 'guarded'
  nftObjectId: string
  vaultObjectId: string
  createDigest?: string
  messagingPackageId?: string
  displayLabel?: string
}

function normOid(id: string): string {
  return id.trim().toLowerCase()
}

export function buildNftVaultHandoffFromLocal(nftObjectId: string): NftVaultHandoffPack | null {
  const oid = normOid(nftObjectId)
  const card = getNftKeycard(oid)
  const bv = card?.boundVault
  const purse = findNftGuardedPurseByNft(oid)
  const treasury = findNftBearerTreasuryByNft(oid)

  if (bv?.vaultObjectId) {
    return {
      v: 1,
      kind: bv.kind,
      nftObjectId: oid,
      vaultObjectId: normOid(bv.vaultObjectId),
      ...(bv.createDigest ? { createDigest: bv.createDigest } : {}),
      ...(bv.messagingPackageId ? { messagingPackageId: bv.messagingPackageId } : {}),
      ...(card?.label ? { displayLabel: card.label } : {}),
    }
  }
  if (treasury) {
    return {
      v: 1,
      kind: 'bearer',
      nftObjectId: oid,
      vaultObjectId: normOid(treasury.treasuryObjectId),
      ...(treasury.createDigest ? { createDigest: treasury.createDigest } : {}),
      ...(treasury.messagingPackageId ? { messagingPackageId: treasury.messagingPackageId } : {}),
      ...(treasury.displayLabel ? { displayLabel: treasury.displayLabel } : {}),
    }
  }
  if (purse) {
    return {
      v: 1,
      kind: 'guarded',
      nftObjectId: oid,
      vaultObjectId: normOid(purse.purseObjectId),
      ...(purse.createDigest ? { createDigest: purse.createDigest } : {}),
      ...(purse.messagingPackageId ? { messagingPackageId: purse.messagingPackageId } : {}),
      ...(purse.displayLabel ? { displayLabel: purse.displayLabel } : {}),
    }
  }
  return null
}

export function encodeNftVaultHandoff(pack: NftVaultHandoffPack): string {
  return NFT_VAULT_HANDOFF_PREFIX + JSON.stringify(pack)
}

export function parseNftVaultHandoff(raw: string): NftVaultHandoffPack | null {
  const t = raw.trim()
  const json = t.startsWith(NFT_VAULT_HANDOFF_PREFIX)
    ? t.slice(NFT_VAULT_HANDOFF_PREFIX.length)
    : t.startsWith('{')
      ? t
      : ''
  if (!json) return null
  try {
    const j = JSON.parse(json) as Partial<NftVaultHandoffPack>
    if (j.v !== 1) return null
    if (j.kind !== 'bearer' && j.kind !== 'guarded') return null
    const nftObjectId = normOid(String(j.nftObjectId || ''))
    const vaultObjectId = normOid(String(j.vaultObjectId || ''))
    if (!/^0x[a-f0-9]{64}$/.test(nftObjectId) || !/^0x[a-f0-9]{64}$/.test(vaultObjectId)) return null
    return {
      v: 1,
      kind: j.kind,
      nftObjectId,
      vaultObjectId,
      ...(typeof j.createDigest === 'string' && j.createDigest.trim()
        ? { createDigest: j.createDigest.trim() }
        : {}),
      ...(typeof j.messagingPackageId === 'string' && j.messagingPackageId.trim()
        ? { messagingPackageId: j.messagingPackageId.trim().toLowerCase() }
        : {}),
      ...(typeof j.displayLabel === 'string' && j.displayLabel.trim()
        ? { displayLabel: j.displayLabel.trim() }
        : {}),
    }
  } catch {
    return null
  }
}

/** Index + optional Schlüsselkarte (Empfänger-Gerät). */
export function applyNftVaultHandoff(pack: NftVaultHandoffPack): {
  ok: true
  note: string
} {
  const placeholder = '0x' + '00'.repeat(32)
  if (pack.kind === 'bearer') {
    upsertNftBearerTreasuryLocal({
      treasuryObjectId: pack.vaultObjectId,
      nftObjectId: pack.nftObjectId,
      admin: placeholder,
      balanceMistHint: '?',
      frozen: false,
      status: 'active',
      ...(pack.createDigest ? { createDigest: pack.createDigest } : {}),
      ...(pack.messagingPackageId ? { messagingPackageId: pack.messagingPackageId } : {}),
      ...(pack.displayLabel ? { displayLabel: pack.displayLabel } : {}),
    })
  } else {
    upsertNftGuardedPurseLocal({
      purseObjectId: pack.vaultObjectId,
      nftObjectId: pack.nftObjectId,
      owner: placeholder,
      balanceMistHint: '?',
      status: 'active',
      ...(pack.createDigest ? { createDigest: pack.createDigest } : {}),
      ...(pack.messagingPackageId ? { messagingPackageId: pack.messagingPackageId } : {}),
      ...(pack.displayLabel ? { displayLabel: pack.displayLabel } : {}),
    })
  }

  const bound: NftKeycardBoundVault = {
    kind: pack.kind,
    vaultObjectId: pack.vaultObjectId,
    ...(pack.createDigest ? { createDigest: pack.createDigest } : {}),
    ...(pack.messagingPackageId ? { messagingPackageId: pack.messagingPackageId } : {}),
  }
  const bind = bindVaultToNftKeycard({ objectId: pack.nftObjectId, vault: bound })
  const note = bind.ok
    ? 'Index + Schlüsselkarte aktualisiert. Balance on-chain nachladen.'
    : `Index gesetzt. Schlüsselkarte: ${bind.error} (Karte zuerst merken, dann erneut importieren).`
  return { ok: true, note }
}

/** boundVault der Karte → lokaler Purse/Treasury-Index. */
export function hydrateLocalIndexFromKeycardBoundVault(nftObjectId: string): boolean {
  const card = getNftKeycard(nftObjectId)
  const bv = card?.boundVault
  if (!bv?.vaultObjectId) return false
  applyNftVaultHandoff({
    v: 1,
    kind: bv.kind,
    nftObjectId: normOid(nftObjectId),
    vaultObjectId: normOid(bv.vaultObjectId),
    ...(bv.createDigest ? { createDigest: bv.createDigest } : {}),
    ...(bv.messagingPackageId ? { messagingPackageId: bv.messagingPackageId } : {}),
    ...(card?.label ? { displayLabel: card.label } : {}),
  })
  return true
}

export function nftVaultTransferHint(kind: 'bearer' | 'guarded' | null): string {
  if (kind === 'bearer') {
    return 'Bearer: Senderecht wandert mit dem NFT. Empfänger braucht Vault-ID oder Digest (Übergabe-Paket), sonst sieht er den Betrag in der App nicht — on-chain liegt er trotzdem in der Treasury.'
  }
  if (kind === 'guarded') {
    return 'Guarded: Coins bleiben bei der ursprünglichen Wallet. NFT-Transfer allein bewegt kein Guthaben — Auszahlen nur, wenn NFT wieder bei dieser Wallet ist.'
  }
  return 'Kein gebundenes Guthaben an dieser Karte (oder Index fehlt).'
}
