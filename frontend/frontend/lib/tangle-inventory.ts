'use client'

export type TangleInventoryType = 'text' | 'image' | 'protocol-hash' | 'protocol-full' | 'unknown'
export type TangleInventoryStatus = 'anchored' | 'queued' | 'failed'

/** Woher der Chain-Eintrag stammt (Anzeige + Filter). */
export type TangleInventoryOrigin = 'mailbox' | 'path4' | 'anchor' | 'relay' | 'forensic-batch' | 'unknown'

export type TangleInventoryItem = {
  id: string
  digest: string
  timestamp: number
  type: TangleInventoryType
  status: TangleInventoryStatus
  /** Sendepfad zum Zeitpunkt der Verankerung */
  origin?: TangleInventoryOrigin
  nonce?: string
  encrypted?: boolean
  chunkSha256?: string
  anchorHashHex?: string
  chunkPart?: number
  chunkTotal?: number
  /** Klartext-Vorschau (lokal, für „Text laden“). */
  contentPreview?: string
  /** Zeitpunkt „Beweis lokal gesichert“ (Digest + Metadaten (+ Text falls vorhanden)). */
  evidenceSecuredAt?: number
}

const LS_KEY = 'morgendrot.tangleInventory.v1'
const MAX_ITEMS = 250

function inferOrigin(item: Pick<TangleInventoryItem, 'origin' | 'type'>): TangleInventoryOrigin {
  if (item.origin) return item.origin
  if (item.type === 'protocol-hash' || item.type === 'protocol-full') return 'anchor'
  return 'unknown'
}

/** Chat-/Mailbox-IOTA (kein Protokoll-Anker, kein Relay-Markierung). */
export function isTangleInventoryUserMessage(item: TangleInventoryItem): boolean {
  const origin = inferOrigin(item)
  if (origin === 'anchor' || origin === 'relay') return false
  if (item.type === 'protocol-hash' || item.type === 'protocol-full') return false
  return true
}

export function tangleInventoryOriginLabel(origin: TangleInventoryOrigin | undefined, type?: TangleInventoryType): string {
  const o = origin ?? (type === 'protocol-hash' || type === 'protocol-full' ? 'anchor' : 'unknown')
  switch (o) {
    case 'mailbox':
      return 'Online (IOTA-Mailbox)'
    case 'path4':
      return 'Funk + IOTA-Spiegel (Pfad 4)'
    case 'anchor':
      return 'Protokoll-Verankerung'
    case 'forensic-batch':
      return 'Mainnet-Batch-Archiv (§ H.33e)'
    case 'relay':
      return 'Relay / manuell markiert'
    default:
      return 'IOTA (unbekannter Pfad)'
  }
}

export function canRecoverTangleInventoryText(item: TangleInventoryItem): boolean {
  const origin = inferOrigin(item)
  if (origin === 'anchor') return false
  if (origin === 'relay' && !item.nonce?.trim()) return false
  return true
}

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

function buildItem(
  item: Omit<TangleInventoryItem, 'id' | 'timestamp'> & { timestamp?: number }
): TangleInventoryItem {
  const digest = String(item.digest || '').trim()
  return {
    id: `${digest}:${item.nonce ?? ''}:${item.timestamp ?? Date.now()}`,
    digest,
    timestamp: item.timestamp ?? Date.now(),
    type: item.type,
    status: item.status,
    origin: item.origin ?? inferOrigin(item),
    nonce: item.nonce,
    encrypted: item.encrypted,
    chunkSha256: item.chunkSha256,
    anchorHashHex: item.anchorHashHex,
    chunkPart: item.chunkPart,
    chunkTotal: item.chunkTotal,
    contentPreview: item.contentPreview,
    evidenceSecuredAt: item.evidenceSecuredAt,
  }
}

export function addTangleInventoryItem(item: Omit<TangleInventoryItem, 'id' | 'timestamp'> & { timestamp?: number }) {
  const digest = String(item.digest || '').trim()
  if (!digest) return
  const next = buildItem(item)
  const prev = loadTangleInventory()
  const deduped = prev.filter((x) => !(x.digest === next.digest && (x.nonce ?? '') === (next.nonce ?? '')))
  saveTangleInventory([next, ...deduped])
}

export function addManyTangleInventoryItems(
  items: Array<Omit<TangleInventoryItem, 'id' | 'timestamp'> & { timestamp?: number }>
) {
  if (!Array.isArray(items) || items.length === 0) return
  let next = loadTangleInventory()
  for (const item of items) {
    const digest = String(item.digest || '').trim()
    if (!digest) continue
    const incoming = buildItem({
      ...item,
      timestamp: Number.isFinite(item.timestamp) ? Number(item.timestamp) : Date.now(),
    })
    next = [incoming, ...next.filter((x) => !(x.digest === incoming.digest && (x.nonce ?? '') === (incoming.nonce ?? '')))]
  }
  saveTangleInventory(next)
}

export function updateTangleInventoryItem(
  id: string,
  patch: Partial<Pick<TangleInventoryItem, 'contentPreview' | 'origin' | 'status' | 'type' | 'evidenceSecuredAt'>>
): boolean {
  const prev = loadTangleInventory()
  let changed = false
  const next = prev.map((it) => {
    if (it.id !== id) return it
    changed = true
    return { ...it, ...patch }
  })
  if (changed) saveTangleInventory(next)
  return changed
}

export function removeTangleInventoryItem(id: string): boolean {
  const prev = loadTangleInventory()
  const next = prev.filter((it) => it.id !== id)
  if (next.length === prev.length) return false
  saveTangleInventory(next)
  return true
}

export function countTangleInventory(filter?: {
  status?: TangleInventoryStatus | 'all'
  userMessagesOnly?: boolean
}): number {
  let items = loadTangleInventory()
  if (filter?.userMessagesOnly) items = items.filter(isTangleInventoryUserMessage)
  if (!filter?.status || filter.status === 'all') return items.length
  return items.filter((x) => x.status === filter.status).length
}

export function clearTangleInventory() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}
