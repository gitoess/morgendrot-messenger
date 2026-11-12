/**
 * Produktregel: max. 1 aktives Vault pro NFT und Modus (Guarded | Bearer).
 * Chain erlaubt mehrere — App blockiert Create, sonst unsichtbares Guthaben.
 */

import { findNftGuardedPurseByNft } from '@/frontend/lib/nft-guarded-purse-local-store'
import { findNftBearerTreasuryByNft } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { getNftKeycard } from '@/frontend/lib/nft-keycard-local-store'

export type NftVaultModeKind = 'guarded' | 'bearer'

export type ExistingVaultForMode = {
  kind: NftVaultModeKind
  vaultObjectId: string
  source: 'index' | 'boundVault'
}

const HEX64 = /^0x[a-f0-9]{64}$/

function norm(id: string): string {
  return id.trim().toLowerCase()
}

/** Lokaler Index oder Schlüsselkarte-boundVault für denselben Modus. */
export function findExistingVaultForNftMode(
  nftObjectId: string,
  kind: NftVaultModeKind
): ExistingVaultForMode | null {
  const nft = norm(nftObjectId)
  if (!HEX64.test(nft)) return null

  if (kind === 'guarded') {
    const purse = findNftGuardedPurseByNft(nft)
    if (purse?.purseObjectId) {
      return { kind, vaultObjectId: purse.purseObjectId, source: 'index' }
    }
  } else {
    const tr = findNftBearerTreasuryByNft(nft)
    if (tr?.treasuryObjectId) {
      return { kind, vaultObjectId: tr.treasuryObjectId, source: 'index' }
    }
  }

  const bv = getNftKeycard(nft)?.boundVault
  if (bv?.kind === kind && bv.vaultObjectId && HEX64.test(norm(bv.vaultObjectId))) {
    return { kind, vaultObjectId: norm(bv.vaultObjectId), source: 'boundVault' }
  }
  return null
}

export function formatSecondVaultBlockedError(
  existing: ExistingVaultForMode
): string {
  const label = existing.kind === 'guarded' ? 'Guarded-Purse' : 'Bearer-Treasury'
  const id = existing.vaultObjectId
  const short = `${id.slice(0, 12)}…`
  return (
    `Bereits eine ${label} für dieses NFT (${short}). ` +
    `Kein zweites Anlegen — bitte Einzahlen. Vault-ID: ${id}`
  )
}

/** Hartes Create-Gate (lokal). Vor Chain-TX aufrufen. */
export function assertCanCreateVaultForNftMode(
  nftObjectId: string,
  kind: NftVaultModeKind
): { ok: true } | { ok: false; error: string; existing: ExistingVaultForMode } {
  const existing = findExistingVaultForNftMode(nftObjectId, kind)
  if (!existing) return { ok: true }
  return { ok: false, error: formatSecondVaultBlockedError(existing), existing }
}

/**
 * Discovery nachziehen, dann erneut prüfen (deckt „Index leer, Chain hat schon Vault“ ab).
 */
export async function assertCanCreateVaultForNftModeWithDiscover(
  nftObjectId: string,
  kind: NftVaultModeKind
): Promise<{ ok: true } | { ok: false; error: string; existing: ExistingVaultForMode }> {
  const first = assertCanCreateVaultForNftMode(nftObjectId, kind)
  if (!first.ok) return first
  try {
    const { syncDiscoveredVaultsIntoLocalIndex } = await import(
      '@/frontend/lib/nft-vault-discover-onchain'
    )
    await syncDiscoveredVaultsIntoLocalIndex()
  } catch {
    /* offline / kein Signer — lokal weiter */
  }
  return assertCanCreateVaultForNftMode(nftObjectId, kind)
}
