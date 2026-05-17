'use client'

export type TangleInventoryType = 'text' | 'image' | 'protocol-hash' | 'protocol-full' | 'unknown'
export type TangleInventoryStatus = 'anchored' | 'queued' | 'failed'

export type TangleInventoryItem = {
  id: string
  digest: string
  timestamp: number
  type: TangleInventoryType
  status: TangleInventoryStatus
  nonce?: string
  encrypted?: boolean
  /** SHA-256 des gesamten Vollbericht-JSON bei mehrteiliger Verankerung */
  chunkSha256?: string
  /** SHA-256 des kanonischen Nachrichtenauszugs (Variante A Hash-Anker) */
  anchorHashHex?: string
  chunkPart?: number
  chunkTotal?: number
}

const LS_KEY = 'morgendrot.tangleInventory.v1'
const MAX_ITEMS = 250

export function loadTangleInventory(): TangleInventoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x): x is TangleInventoryItem => !!x && typeof x === 'object')
      .filter((x) => typeof x.digest === 'string' && typeof x.timestamp === 'number')
      .sort((a, b) => b.timestamp - a.timestamp)
  } catch {
    return []
  }
}

function saveTangleInventory(items: TangleInventoryItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    /* ignore */
  }
}

export function addTangleInventoryItem(item: Omit<TangleInventoryItem, 'id' | 'timestamp'> & { timestamp?: number }) {
  const digest = String(item.digest || '').trim()
  if (!digest) return
  const next: TangleInventoryItem = {
    id: `${digest}:${item.nonce ?? ''}:${Date.now()}`,
    digest,
    timestamp: item.timestamp ?? Date.now(),
    type: item.type,
    status: item.status,
    nonce: item.nonce,
    encrypted: item.encrypted,
  }
  const prev = loadTangleInventory()
  const deduped = prev.filter((x) => !(x.digest === next.digest && (x.nonce ?? '') === (next.nonce ?? '')))
  saveTangleInventory([next, ...deduped])
}

export function addManyTangleInventoryItems(items: Array<Omit<TangleInventoryItem, 'id'>>) {
  if (!Array.isArray(items) || items.length === 0) return
  let next = loadTangleInventory()
  for (const item of items) {
    const digest = String(item.digest || '').trim()
    if (!digest) continue
    const incoming: TangleInventoryItem = {
      id: `${digest}:${item.nonce ?? ''}:${item.timestamp ?? Date.now()}`,
      digest,
      timestamp: Number.isFinite(item.timestamp) ? Number(item.timestamp) : Date.now(),
      type: item.type ?? 'unknown',
      status: item.status ?? 'anchored',
      nonce: item.nonce,
      encrypted: item.encrypted,
    }
    next = [incoming, ...next.filter((x) => !(x.digest === incoming.digest && (x.nonce ?? '') === (incoming.nonce ?? '')))]
  }
  saveTangleInventory(next)
}

export function clearTangleInventory() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}
