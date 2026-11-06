/**
 * B2-P5b — lokale Merker für Zeitkapsel-Leases (Badges / UI).
 * On-Chain-Wahrheit = shared NftTimeLease; dies ist nur Komfort-Index.
 */

export const NFT_TIME_LEASE_LS_KEY = 'morgendrot.nftTimeLease.v1'
export const NFT_TIME_LEASE_CHANGED = 'morgendrot:nft-time-lease'

export type NftTimeLeaseLocalEntry = {
  leaseObjectId: string
  nftObjectId: string
  lender: string
  borrower: string
  unlockMs: number
  reclaimCancelled: boolean
  /** UI-Status-Hinweis */
  status: 'active' | 'cancelled' | 'returned' | 'reclaimed'
  updatedAtMs: number
}

type StoreV1 = { v: 1; leases: Record<string, NftTimeLeaseLocalEntry> }

function norm(id: string): string {
  return id.trim().toLowerCase()
}

function readStore(): StoreV1 {
  if (typeof window === 'undefined') return { v: 1, leases: {} }
  try {
    const raw = window.localStorage.getItem(NFT_TIME_LEASE_LS_KEY)
    if (!raw) return { v: 1, leases: {} }
    const j = JSON.parse(raw) as StoreV1
    if (j?.v !== 1 || !j.leases) return { v: 1, leases: {} }
    return j
  } catch {
    return { v: 1, leases: {} }
  }
}

function writeStore(s: StoreV1): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NFT_TIME_LEASE_LS_KEY, JSON.stringify(s))
    window.dispatchEvent(new Event(NFT_TIME_LEASE_CHANGED))
  } catch {
    /* ignore */
  }
}

export function upsertNftTimeLeaseLocal(entry: Omit<NftTimeLeaseLocalEntry, 'updatedAtMs'>): void {
  const s = readStore()
  const id = norm(entry.leaseObjectId)
  s.leases[id] = {
    ...entry,
    leaseObjectId: id,
    nftObjectId: norm(entry.nftObjectId),
    lender: norm(entry.lender),
    borrower: norm(entry.borrower),
    updatedAtMs: Date.now(),
  }
  writeStore(s)
}

export function patchNftTimeLeaseLocal(
  leaseObjectId: string,
  patch: Partial<Pick<NftTimeLeaseLocalEntry, 'reclaimCancelled' | 'status' | 'unlockMs'>>
): void {
  const s = readStore()
  const id = norm(leaseObjectId)
  const cur = s.leases[id]
  if (!cur) return
  s.leases[id] = { ...cur, ...patch, updatedAtMs: Date.now() }
  writeStore(s)
}

export function listNftTimeLeasesLocal(): NftTimeLeaseLocalEntry[] {
  return Object.values(readStore().leases).sort((a, b) => b.updatedAtMs - a.updatedAtMs)
}

export function findNftTimeLeaseByNft(nftObjectId: string): NftTimeLeaseLocalEntry | null {
  const n = norm(nftObjectId)
  const hits = listNftTimeLeasesLocal().filter(
    (e) => e.nftObjectId === n && (e.status === 'active' || e.status === 'cancelled')
  )
  return hits[0] ?? null
}

/** Badge-Text laut Spec §7. */
export function nftTimeLeaseBadgeText(
  entry: NftTimeLeaseLocalEntry,
  nowMs = Date.now()
): string {
  if (entry.status === 'reclaimed' || entry.status === 'returned') {
    return 'Archiv-Modus: wer W1 (Seed) und NFT besitzt, kann lesen'
  }
  if (entry.reclaimCancelled || entry.status === 'cancelled') {
    return 'Timelock widerrufen — bleibt privat bei aktuellem NFT-Besitzer'
  }
  const when = new Date(entry.unlockMs).toLocaleString()
  if (nowMs < entry.unlockMs) {
    return `Nur mit NFT in dieser Wallet lesbar · Geplante Veröffentlichung: ${when} (Reclaim), sofern nicht widerrufen`
  }
  return `Reclaim möglich seit ${when} — TX nötig (kein Auto-Cron)`
}

/** Borrower während aktiver Leihe (Escrow) darf App-Gate lesen. */
export function isNftTimeLeaseBorrowerActive(
  entry: NftTimeLeaseLocalEntry | null | undefined,
  signerAddress: string
): boolean {
  if (!entry) return false
  if (entry.status !== 'active' && entry.status !== 'cancelled') return false
  return norm(entry.borrower) === norm(signerAddress)
}
