/**
 * Geparkte Purse/Treasury-Bindungen (nach NFT-Versand).
 * Bleiben lokal + im Tresor-Sidecar, bis das NFT wieder bei uns ist → restore.
 */

import { hasVaultPasswordSession } from '@/frontend/lib/vault-password-session'

export const NFT_VAULT_PARKED_LS_KEY = 'morgendrot.nftVaultParked.v1'
export const NFT_VAULT_PARKED_CHANGED = 'morgendrot:nft-vault-parked'

export type NftVaultParkedEntry = {
  nftObjectId: string
  kind: 'guarded' | 'bearer'
  vaultObjectId: string
  createDigest?: string
  messagingPackageId?: string
  displayLabel?: string
  balanceMistHint?: string
  ownerOrAdmin?: string
  frozen?: boolean
  parkedAtMs: number
}

type StoreV1 = { v: 1; parked: NftVaultParkedEntry[] }

function norm(id: string): string {
  return id.trim().toLowerCase()
}

function emit(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(NFT_VAULT_PARKED_CHANGED))
  } catch {
    /* ignore */
  }
}

function readStore(): StoreV1 {
  if (typeof window === 'undefined') return { v: 1, parked: [] }
  try {
    const raw = window.localStorage.getItem(NFT_VAULT_PARKED_LS_KEY)
    if (!raw) return { v: 1, parked: [] }
    const j = JSON.parse(raw) as StoreV1
    if (j?.v !== 1 || !Array.isArray(j.parked)) return { v: 1, parked: [] }
    return j
  } catch {
    return { v: 1, parked: [] }
  }
}

function writeStore(s: StoreV1): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NFT_VAULT_PARKED_LS_KEY, JSON.stringify(s))
    emit()
  } catch {
    /* ignore */
  }
  try {
    void import('@/frontend/lib/nft-vault-index-vault').then((m) => m.scheduleNftVaultIndexPersist())
  } catch {
    /* ignore */
  }
}

export function listParkedNftVaults(): NftVaultParkedEntry[] {
  return [...readStore().parked].sort((a, b) => b.parkedAtMs - a.parkedAtMs)
}

export function upsertParkedNftVault(entry: NftVaultParkedEntry): void {
  const s = readStore()
  const nft = norm(entry.nftObjectId)
  const vault = norm(entry.vaultObjectId)
  const next = s.parked.filter(
    (p) => !(p.nftObjectId === nft && p.vaultObjectId === vault && p.kind === entry.kind)
  )
  next.push({
    ...entry,
    nftObjectId: nft,
    vaultObjectId: vault,
    parkedAtMs: entry.parkedAtMs || Date.now(),
  })
  writeStore({ v: 1, parked: next })
}

export function removeParkedNftVault(vaultObjectId: string): void {
  const id = norm(vaultObjectId)
  const s = readStore()
  writeStore({ v: 1, parked: s.parked.filter((p) => p.vaultObjectId !== id) })
}

export function replaceAllParkedNftVaults(parked: NftVaultParkedEntry[]): void {
  writeStore({
    v: 1,
    parked: parked.map((p) => ({
      ...p,
      nftObjectId: norm(p.nftObjectId),
      vaultObjectId: norm(p.vaultObjectId),
    })),
  })
}

export function vaultSessionNeededForDurableIndex(): boolean {
  return !hasVaultPasswordSession()
}
