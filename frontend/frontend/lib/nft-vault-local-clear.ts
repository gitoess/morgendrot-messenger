/**
 * Nach NFT-Transfer/Burn: aktiven Index parken (nicht vernichten).
 * Bei Rückkehr → restoreParkedVaultsForOwnedNfts.
 */

import {
  listNftBearerTreasuriesLocal,
  removeNftBearerTreasuryLocal,
  upsertNftBearerTreasuryLocal,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  listNftGuardedPursesLocal,
  removeNftGuardedPurseLocal,
  upsertNftGuardedPurseLocal,
} from '@/frontend/lib/nft-guarded-purse-local-store'
import { getNftKeycard } from '@/frontend/lib/nft-keycard-local-store'
import {
  listParkedNftVaults,
  removeParkedNftVault,
  upsertParkedNftVault,
  type NftVaultParkedEntry,
} from '@/frontend/lib/nft-vault-parked-store'
import { noteNftNoLongerOwned } from '@/frontend/lib/nft-owned-snapshot'

const PLACEHOLDER = '0x' + '00'.repeat(32)

/** Aktive Bindung → Parkplatz; Anzeige verschwindet, Tresor/LS behalten Metadaten. */
export function parkLocalVaultIndexForNft(nftObjectId: string): {
  parkedGuarded: number
  parkedBearer: number
} {
  const n = nftObjectId.trim().toLowerCase()
  let parkedGuarded = 0
  let parkedBearer = 0
  const card = getNftKeycard(n)
  const bv = card?.boundVault

  for (const p of listNftGuardedPursesLocal()) {
    if (p.nftObjectId !== n) continue
    upsertParkedNftVault({
      nftObjectId: n,
      kind: 'guarded',
      vaultObjectId: p.purseObjectId,
      ...(p.createDigest ? { createDigest: p.createDigest } : {}),
      ...(p.messagingPackageId ? { messagingPackageId: p.messagingPackageId } : {}),
      ...(p.displayLabel ? { displayLabel: p.displayLabel } : {}),
      ...(p.balanceMistHint ? { balanceMistHint: p.balanceMistHint } : {}),
      ownerOrAdmin: p.owner,
      parkedAtMs: Date.now(),
    })
    removeNftGuardedPurseLocal(p.purseObjectId)
    parkedGuarded += 1
  }
  for (const t of listNftBearerTreasuriesLocal()) {
    if (t.nftObjectId !== n) continue
    upsertParkedNftVault({
      nftObjectId: n,
      kind: 'bearer',
      vaultObjectId: t.treasuryObjectId,
      ...(t.createDigest ? { createDigest: t.createDigest } : {}),
      ...(t.messagingPackageId ? { messagingPackageId: t.messagingPackageId } : {}),
      ...(t.displayLabel ? { displayLabel: t.displayLabel } : {}),
      ...(t.balanceMistHint ? { balanceMistHint: t.balanceMistHint } : {}),
      ownerOrAdmin: t.admin,
      frozen: t.frozen,
      parkedAtMs: Date.now(),
    })
    removeNftBearerTreasuryLocal(t.treasuryObjectId)
    parkedBearer += 1
  }

  // Nur boundVault an der Karte, kein aktiver Index
  if (bv?.vaultObjectId && parkedGuarded + parkedBearer === 0) {
    upsertParkedNftVault({
      nftObjectId: n,
      kind: bv.kind,
      vaultObjectId: bv.vaultObjectId,
      ...(bv.createDigest ? { createDigest: bv.createDigest } : {}),
      ...(bv.messagingPackageId ? { messagingPackageId: bv.messagingPackageId } : {}),
      ...(card?.label ? { displayLabel: card.label } : {}),
      parkedAtMs: Date.now(),
    })
    if (bv.kind === 'guarded') parkedGuarded += 1
    else parkedBearer += 1
  }

  noteNftNoLongerOwned(n)
  return { parkedGuarded, parkedBearer }
}

/** @deprecated Alias — park, nicht löschen. */
export function forgetLocalVaultIndexForNft(nftObjectId: string): {
  removedGuarded: number
  removedBearer: number
} {
  const r = parkLocalVaultIndexForNft(nftObjectId)
  return { removedGuarded: r.parkedGuarded, removedBearer: r.parkedBearer }
}

function activateParked(p: NftVaultParkedEntry): void {
  if (p.kind === 'guarded') {
    upsertNftGuardedPurseLocal({
      purseObjectId: p.vaultObjectId,
      nftObjectId: p.nftObjectId,
      owner: p.ownerOrAdmin || PLACEHOLDER,
      balanceMistHint: p.balanceMistHint || '?',
      status: 'active',
      ...(p.createDigest ? { createDigest: p.createDigest } : {}),
      ...(p.messagingPackageId ? { messagingPackageId: p.messagingPackageId } : {}),
      ...(p.displayLabel ? { displayLabel: p.displayLabel } : {}),
    })
  } else {
    upsertNftBearerTreasuryLocal({
      treasuryObjectId: p.vaultObjectId,
      nftObjectId: p.nftObjectId,
      admin: p.ownerOrAdmin || PLACEHOLDER,
      balanceMistHint: p.balanceMistHint || '?',
      frozen: Boolean(p.frozen),
      status: 'active',
      ...(p.createDigest ? { createDigest: p.createDigest } : {}),
      ...(p.messagingPackageId ? { messagingPackageId: p.messagingPackageId } : {}),
      ...(p.displayLabel ? { displayLabel: p.displayLabel } : {}),
    })
  }
  removeParkedNftVault(p.vaultObjectId)
}

/** NFT wieder in Besitz → geparkte Bindungen aktivieren. */
export function restoreParkedVaultsForOwnedNfts(ownedNftObjectIds: readonly string[]): {
  restored: number
  entries: NftVaultParkedEntry[]
} {
  const owned = new Set(
    ownedNftObjectIds.map((x) => x.trim().toLowerCase()).filter((x) => /^0x[a-f0-9]{64}$/.test(x))
  )
  const restoredList: NftVaultParkedEntry[] = []
  for (const p of listParkedNftVaults()) {
    if (!owned.has(p.nftObjectId)) continue
    activateParked(p)
    restoredList.push(p)
  }
  return { restored: restoredList.length, entries: restoredList }
}
