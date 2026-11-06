/**
 * B2-S3 — lokaler Index für Bearer Treasuries (Badge / UI).
 */

export const NFT_BEARER_TREASURY_LS_KEY = 'morgendrot.nftBearerTreasury.v1'
export const NFT_BEARER_TREASURY_CHANGED = 'morgendrot:nft-bearer-treasury'

export type NftBearerTreasuryLocalEntry = {
  treasuryObjectId: string
  nftObjectId: string
  admin: string
  balanceMistHint: string
  frozen: boolean
  status: 'active' | 'destroyed'
  updatedAtMs: number
}

type StoreV1 = { v: 1; treasuries: Record<string, NftBearerTreasuryLocalEntry> }

function norm(id: string): string {
  return id.trim().toLowerCase()
}

function readStore(): StoreV1 {
  if (typeof window === 'undefined') return { v: 1, treasuries: {} }
  try {
    const raw = window.localStorage.getItem(NFT_BEARER_TREASURY_LS_KEY)
    if (!raw) return { v: 1, treasuries: {} }
    const j = JSON.parse(raw) as StoreV1
    if (j?.v !== 1 || !j.treasuries) return { v: 1, treasuries: {} }
    return j
  } catch {
    return { v: 1, treasuries: {} }
  }
}

function writeStore(s: StoreV1): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NFT_BEARER_TREASURY_LS_KEY, JSON.stringify(s))
    window.dispatchEvent(new Event(NFT_BEARER_TREASURY_CHANGED))
  } catch {
    /* ignore */
  }
}

export function upsertNftBearerTreasuryLocal(
  entry: Omit<NftBearerTreasuryLocalEntry, 'updatedAtMs'>
): void {
  const s = readStore()
  const id = norm(entry.treasuryObjectId)
  s.treasuries[id] = {
    ...entry,
    treasuryObjectId: id,
    nftObjectId: norm(entry.nftObjectId),
    admin: norm(entry.admin),
    updatedAtMs: Date.now(),
  }
  writeStore(s)
}

export function patchNftBearerTreasuryLocal(
  treasuryObjectId: string,
  patch: Partial<Pick<NftBearerTreasuryLocalEntry, 'balanceMistHint' | 'frozen' | 'status'>>
): void {
  const s = readStore()
  const id = norm(treasuryObjectId)
  const cur = s.treasuries[id]
  if (!cur) return
  s.treasuries[id] = { ...cur, ...patch, updatedAtMs: Date.now() }
  writeStore(s)
}

export function removeNftBearerTreasuryLocal(treasuryObjectId: string): void {
  const s = readStore()
  delete s.treasuries[norm(treasuryObjectId)]
  writeStore(s)
}

export function listNftBearerTreasuriesLocal(): NftBearerTreasuryLocalEntry[] {
  return Object.values(readStore().treasuries).sort((a, b) => b.updatedAtMs - a.updatedAtMs)
}

export function findNftBearerTreasuryByNft(nftObjectId: string): NftBearerTreasuryLocalEntry | null {
  const n = norm(nftObjectId)
  return (
    listNftBearerTreasuriesLocal().find((t) => t.nftObjectId === n && t.status === 'active') || null
  )
}

export function nftBearerTreasuryBadgeText(e: NftBearerTreasuryLocalEntry): string {
  if (e.status === 'destroyed') return 'Bearer Treasury zerstört (lokal)'
  const fro = e.frozen ? ' · EINGEFROREN' : ''
  return `Treasury: wer NFT hat, darf senden · ${e.treasuryObjectId.slice(0, 10)}… · ~${e.balanceMistHint} MIST${fro}`
}
