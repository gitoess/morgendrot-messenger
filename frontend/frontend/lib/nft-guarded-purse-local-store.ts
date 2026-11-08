/**
 * B2-S2 — lokaler Index für Guarded Purses (Badge / UI).
 * On-Chain-Wahrheit = owned GuardedPurse; dies ist nur Komfort-Index.
 */

export const NFT_GUARDED_PURSE_LS_KEY = 'morgendrot.nftGuardedPurse.v1'
export const NFT_GUARDED_PURSE_CHANGED = 'morgendrot:nft-guarded-purse'

export type NftGuardedPurseLocalEntry = {
  purseObjectId: string
  nftObjectId: string
  owner: string
  /** Letzter bekannter Balance-Hinweis in MIST (UI; Chain ist Wahrheit). */
  balanceMistHint: string
  status: 'active' | 'destroyed'
  /** Optionales Anzeigenamen-Label (NFT/Schlüsselkarte). */
  displayLabel?: string
  /** Move-Package der Purse (wichtig bei älteren Upgrades). */
  messagingPackageId?: string
  updatedAtMs: number
}

type StoreV1 = { v: 1; purses: Record<string, NftGuardedPurseLocalEntry> }

function norm(id: string): string {
  return id.trim().toLowerCase()
}

function readStore(): StoreV1 {
  if (typeof window === 'undefined') return { v: 1, purses: {} }
  try {
    const raw = window.localStorage.getItem(NFT_GUARDED_PURSE_LS_KEY)
    if (!raw) return { v: 1, purses: {} }
    const j = JSON.parse(raw) as StoreV1
    if (j?.v !== 1 || !j.purses) return { v: 1, purses: {} }
    return j
  } catch {
    return { v: 1, purses: {} }
  }
}

function writeStore(s: StoreV1): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NFT_GUARDED_PURSE_LS_KEY, JSON.stringify(s))
    window.dispatchEvent(new Event(NFT_GUARDED_PURSE_CHANGED))
  } catch {
    /* ignore */
  }
}

export function upsertNftGuardedPurseLocal(
  entry: Omit<NftGuardedPurseLocalEntry, 'updatedAtMs'>
): void {
  const s = readStore()
  const id = norm(entry.purseObjectId)
  s.purses[id] = {
    ...entry,
    purseObjectId: id,
    nftObjectId: norm(entry.nftObjectId),
    owner: norm(entry.owner),
    updatedAtMs: Date.now(),
  }
  writeStore(s)
}

export function findNftGuardedPurseById(purseObjectId: string): NftGuardedPurseLocalEntry | null {
  const id = norm(purseObjectId)
  return listNftGuardedPursesLocal().find((p) => p.purseObjectId === id) || null
}

export function patchNftGuardedPurseLocal(
  purseObjectId: string,
  patch: Partial<
    Pick<NftGuardedPurseLocalEntry, 'balanceMistHint' | 'status' | 'displayLabel' | 'messagingPackageId'>
  >
): void {
  const s = readStore()
  const id = norm(purseObjectId)
  const cur = s.purses[id]
  if (!cur) return
  s.purses[id] = { ...cur, ...patch, updatedAtMs: Date.now() }
  writeStore(s)
}

export function removeNftGuardedPurseLocal(purseObjectId: string): void {
  const s = readStore()
  delete s.purses[norm(purseObjectId)]
  writeStore(s)
}

export function listNftGuardedPursesLocal(): NftGuardedPurseLocalEntry[] {
  return Object.values(readStore().purses).sort((a, b) => b.updatedAtMs - a.updatedAtMs)
}

export function findNftGuardedPurseByNft(nftObjectId: string): NftGuardedPurseLocalEntry | null {
  const n = norm(nftObjectId)
  const list = listNftGuardedPursesLocal().filter(
    (p) => p.nftObjectId === n && p.status === 'active'
  )
  return list[0] || null
}

export function nftGuardedPurseBadgeText(e: NftGuardedPurseLocalEntry): string {
  if (e.status === 'destroyed') return 'Guarded Purse zerstört (lokal)'
  const mist = e.balanceMistHint || '?'
  return `Guarded (NFT + Wallet) · Purse ${e.purseObjectId.slice(0, 10)}… · Hinweis ${mist}`
}

/** IOTA-Dezimalstring → MIST (9 Nachkommastellen). */
export function iotaDecimalToMist(raw: string): bigint {
  const t = raw.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,9})?$/.test(t)) {
    throw new Error('Ungültiger IOTA-Betrag (z. B. 0.01).')
  }
  const [whole, frac = ''] = t.split('.')
  const mistFrac = (frac + '000000000').slice(0, 9)
  return BigInt(whole) * 1_000_000_000n + BigInt(mistFrac)
}
