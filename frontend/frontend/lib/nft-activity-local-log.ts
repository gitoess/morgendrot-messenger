/**
 * Lokales Protokoll: ImageNFT mint / senden / empfangen / vernichten.
 * Keine Secrets — nur Object-IDs, Richtung, Zeit, optional TX-Digest.
 */

import {
  NFT_OWNED_SNAPSHOT_LS_KEY,
  isNftOwnedSnapshotInitialized,
  noteNftNoLongerOwned as noteNftNoLongerOwnedCore,
  readNftOwnedSnapshot,
  writeNftOwnedSnapshot,
} from '@/frontend/lib/nft-owned-snapshot'

export const NFT_ACTIVITY_LS_KEY = 'morgendrot.nftActivity.v1'
export const NFT_ACTIVITY_CHANGED_EVENT = 'morgendrot:nft-activity'
export { NFT_OWNED_SNAPSHOT_LS_KEY }

const MAX_ENTRIES = 80

export type NftActivityKind = 'mint' | 'sent' | 'received' | 'burned'

export type NftActivityEntry = {
  id: string
  atMs: number
  kind: NftActivityKind
  objectId: string
  /** Gegenadresse bei sent/received, wenn bekannt */
  counterparty?: string
  digest?: string
  label?: string
}

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(NFT_ACTIVITY_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

function readAll(): NftActivityEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(NFT_ACTIVITY_LS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    const out: NftActivityEntry[] = []
    for (const row of j) {
      if (!row || typeof row !== 'object') continue
      const r = row as Partial<NftActivityEntry>
      if (
        typeof r.id === 'string' &&
        typeof r.atMs === 'number' &&
        typeof r.objectId === 'string' &&
        (r.kind === 'mint' || r.kind === 'sent' || r.kind === 'received' || r.kind === 'burned')
      ) {
        out.push({
          id: r.id,
          atMs: r.atMs,
          kind: r.kind,
          objectId: r.objectId.trim().toLowerCase(),
          ...(typeof r.counterparty === 'string' ? { counterparty: r.counterparty.trim().toLowerCase() } : {}),
          ...(typeof r.digest === 'string' ? { digest: r.digest.trim() } : {}),
          ...(typeof r.label === 'string' ? { label: r.label } : {}),
        })
      }
    }
    return out
  } catch {
    return []
  }
}

function writeAll(entries: NftActivityEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    const trimmed = entries.slice(0, MAX_ENTRIES)
    window.localStorage.setItem(NFT_ACTIVITY_LS_KEY, JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
  emitChanged()
}

export function listNftActivity(limit = 40): NftActivityEntry[] {
  return readAll().slice(0, Math.max(1, limit))
}

export function recordNftActivity(input: {
  kind: NftActivityKind
  objectId: string
  counterparty?: string
  digest?: string
  label?: string
  atMs?: number
}): NftActivityEntry | null {
  const objectId = input.objectId.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(objectId)) return null
  const entry: NftActivityEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    atMs: input.atMs ?? Date.now(),
    kind: input.kind,
    objectId,
    ...(input.counterparty?.trim()
      ? { counterparty: input.counterparty.trim().toLowerCase() }
      : {}),
    ...(input.digest?.trim() ? { digest: input.digest.trim() } : {}),
    ...(input.label?.trim() ? { label: input.label.trim().slice(0, 80) } : {}),
  }
  writeAll([entry, ...readAll()])
  return entry
}

export function clearNftActivity(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(NFT_ACTIVITY_LS_KEY)
  } catch {
    /* ignore */
  }
  emitChanged()
}

export function listNftOwnedSnapshot(): string[] {
  return readNftOwnedSnapshot()
}

/** Nach Versand/Burn: Snapshot anpassen, damit Rückkehr als „empfangen“ erkannt wird. */
export function noteNftNoLongerOwned(objectId: string): void {
  noteNftNoLongerOwnedCore(objectId)
}

/** Nach Reclaim/Return: Snapshot setzen, damit Galerie-Sync nicht nochmal „empfangen“ loggt. */
export function noteNftNowOwned(objectId: string): void {
  const oid = objectId.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(oid)) return
  const prev = readNftOwnedSnapshot()
  if (prev.includes(oid)) return
  writeNftOwnedSnapshot([...prev, oid])
}

/**
 * Nach Galerie-Laden: neue Object-IDs als „empfangen“ loggen (ohne Digest).
 * Erster Snapshot erzeugt keine received-Einträge (Baseline).
 * Stellt geparkte Purse/Treasury-Bindungen wieder her, wenn NFT zurück ist.
 */
export function syncNftOwnedSnapshotAndDetectReceived(
  currentObjectIds: readonly string[],
  labelsById?: Record<string, string>
): NftActivityEntry[] {
  const current = [
    ...new Set(
      currentObjectIds
        .map((x) => x.trim().toLowerCase())
        .filter((x) => /^0x[a-f0-9]{64}$/.test(x))
    ),
  ]
  const prev = readNftOwnedSnapshot()
  const added: NftActivityEntry[] = []
  if (isNftOwnedSnapshotInitialized()) {
    const prevSet = new Set(prev)
    for (const id of current) {
      if (prevSet.has(id)) continue
      const e = recordNftActivity({
        kind: 'received',
        objectId: id,
        label: labelsById?.[id],
      })
      if (e) added.push(e)
    }
  }
  writeNftOwnedSnapshot(current)
  void import('@/frontend/lib/nft-vault-local-clear').then((m) => {
    m.restoreParkedVaultsForOwnedNfts(current)
  })
  return added
}
