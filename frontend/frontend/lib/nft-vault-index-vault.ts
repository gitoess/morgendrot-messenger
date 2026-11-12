/**
 * Gesicherte Vault-Metadaten (Purse/Treasury-IDs, Digest, Package) im Secret-Vault.
 * Damit bleiben Bindungen nach Unlock erhalten und können mit dem Tresor wandern —
 * on-chain Balance bleibt die Wahrheit; Index = TBA-ähnliche „Bound Account“-Merker.
 */

import {
  hasVaultEncSidecar,
  readVaultEncSidecar,
  removeVaultEncSidecar,
  writeVaultEncSidecar,
} from '@/frontend/lib/vault-enc-sidecar'
import {
  getVaultPasswordSession,
  hasVaultPasswordSession,
} from '@/frontend/lib/vault-password-session'
import {
  listNftBearerTreasuriesLocal,
  upsertNftBearerTreasuryLocal,
  type NftBearerTreasuryLocalEntry,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  listNftGuardedPursesLocal,
  upsertNftGuardedPurseLocal,
  type NftGuardedPurseLocalEntry,
} from '@/frontend/lib/nft-guarded-purse-local-store'
import {
  listParkedNftVaults,
  replaceAllParkedNftVaults,
  type NftVaultParkedEntry,
} from '@/frontend/lib/nft-vault-parked-store'

export const NFT_VAULT_INDEX_ENC_LS_KEY = 'morgendrot.nftVaultIndex.enc.v1'
export const NFT_VAULT_INDEX_ENC_SCHEMA = 'morgendrot.nft-vault-index.enc.v1'
export const NFT_VAULT_INDEX_CHANGED = 'morgendrot:nft-vault-index'

type StorePlainV1 = {
  v: 1
  purses: NftGuardedPurseLocalEntry[]
  treasuries: NftBearerTreasuryLocalEntry[]
  /** Bindungen nach NFT-Versand — wiederherstellen wenn NFT zurück. */
  parked?: NftVaultParkedEntry[]
}

const SS_TAB = 'morgendrot.nftVaultIndex.tab.v1'
let persistTimer: ReturnType<typeof setTimeout> | null = null

function emit(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(NFT_VAULT_INDEX_CHANGED))
  } catch {
    /* ignore */
  }
}

function snapshotFromLocal(): StorePlainV1 {
  return {
    v: 1,
    purses: listNftGuardedPursesLocal().filter((p) => p.status === 'active'),
    treasuries: listNftBearerTreasuriesLocal().filter((t) => t.status === 'active'),
    parked: listParkedNftVaults(),
  }
}

function writeTab(plain: StorePlainV1): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SS_TAB, JSON.stringify(plain))
  } catch {
    /* ignore */
  }
}

async function persistNow(): Promise<void> {
  const pw = getVaultPasswordSession()
  const plain = snapshotFromLocal()
  writeTab(plain)
  if (!pw) return
  await writeVaultEncSidecar(
    NFT_VAULT_INDEX_ENC_LS_KEY,
    NFT_VAULT_INDEX_ENC_SCHEMA,
    JSON.stringify(plain),
    pw
  )
  emit()
}

export function scheduleNftVaultIndexPersist(): void {
  writeTab(snapshotFromLocal())
  if (!hasVaultPasswordSession()) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persistNow()
  }, 400)
}

export async function flushNftVaultIndexVaultPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await persistNow()
}

function hydrateIntoLocal(plain: StorePlainV1): void {
  for (const p of plain.purses || []) {
    if (!p?.purseObjectId || !p?.nftObjectId) continue
    upsertNftGuardedPurseLocal({
      purseObjectId: p.purseObjectId,
      nftObjectId: p.nftObjectId,
      owner: p.owner || '0x' + '00'.repeat(32),
      balanceMistHint: p.balanceMistHint || '?',
      status: p.status === 'destroyed' ? 'destroyed' : 'active',
      ...(p.displayLabel ? { displayLabel: p.displayLabel } : {}),
      ...(p.messagingPackageId ? { messagingPackageId: p.messagingPackageId } : {}),
      ...(p.createDigest ? { createDigest: p.createDigest } : {}),
    })
  }
  for (const t of plain.treasuries || []) {
    if (!t?.treasuryObjectId || !t?.nftObjectId) continue
    upsertNftBearerTreasuryLocal({
      treasuryObjectId: t.treasuryObjectId,
      nftObjectId: t.nftObjectId,
      admin: t.admin || '0x' + '00'.repeat(32),
      balanceMistHint: t.balanceMistHint || '?',
      frozen: Boolean(t.frozen),
      status: t.status === 'destroyed' ? 'destroyed' : 'active',
      ...(t.displayLabel ? { displayLabel: t.displayLabel } : {}),
      ...(t.messagingPackageId ? { messagingPackageId: t.messagingPackageId } : {}),
      ...(t.createDigest ? { createDigest: t.createDigest } : {}),
    })
  }
  if (Array.isArray(plain.parked)) {
    replaceAllParkedNftVaults(plain.parked)
  }
  emit()
}

export async function unlockNftVaultIndexVault(
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pw = password.trim()
  if (pw.length < 8) return { ok: false, error: 'Vault-Passwort mindestens 8 Zeichen.' }
  try {
    if (hasVaultEncSidecar(NFT_VAULT_INDEX_ENC_LS_KEY)) {
      const r = await readVaultEncSidecar(NFT_VAULT_INDEX_ENC_LS_KEY, NFT_VAULT_INDEX_ENC_SCHEMA, pw)
      if (!r.ok) return { ok: false, error: r.error }
      const plain = JSON.parse(r.plainUtf8) as StorePlainV1
      if (plain?.v === 1) hydrateIntoLocal(plain)
    } else {
      // Erstes Unlock: aktuelle LS-Indexe in Sidecar übernehmen
      await writeVaultEncSidecar(
        NFT_VAULT_INDEX_ENC_LS_KEY,
        NFT_VAULT_INDEX_ENC_SCHEMA,
        JSON.stringify(snapshotFromLocal()),
        pw
      )
    }
    try {
      const { listNftOwnedSnapshot } = await import('@/frontend/lib/nft-activity-local-log')
      const { restoreParkedVaultsForOwnedNfts } = await import('@/frontend/lib/nft-vault-local-clear')
      restoreParkedVaultsForOwnedNfts(listNftOwnedSnapshot())
    } catch {
      /* ignore */
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function lockNftVaultIndexVault(): void {
  /* Index bleibt in LS nutzbar; Secrets sind nur IDs — Lock leert nichts aggressiv. */
}

export function purgeNftVaultIndexVault(): void {
  if (typeof window === 'undefined') return
  try {
    removeVaultEncSidecar(NFT_VAULT_INDEX_ENC_LS_KEY)
    window.sessionStorage.removeItem(SS_TAB)
  } catch {
    /* ignore */
  }
  emit()
}
