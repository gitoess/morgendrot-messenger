import { OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS, OFFLINE_QUEUE_ITEM_STATUS, type OfflineMailboxKind, type OfflineMailboxQueueItem } from './model.js'

export function offlineMailboxDedupKey(item: {
  kind: OfflineMailboxKind
  recipient: string
  encrypted: boolean
  payload: string
}): string {
  const head = item.payload.slice(0, 2048)
  return `${item.kind}|${item.recipient}|${item.encrypted}|${item.payload.length}|${head}`
}

export function maxClientOutSeqIn(items: OfflineMailboxQueueItem[]): number {
  let max = 0
  for (const q of items) {
    if (typeof q.clientOutSeq === 'number' && Number.isFinite(q.clientOutSeq) && q.clientOutSeq > max) {
      max = q.clientOutSeq
    }
  }
  return max
}

/** Nächste monotonische Ausgangs-Sequenznummer (max in Queue + 1). */
export function nextClientOutSeqFromItems(items: OfflineMailboxQueueItem[]): number {
  return maxClientOutSeqIn(items) + 1
}

/** Sortierung für Drain: `clientOutSeq`, dann `createdAt`. */
export function sortOfflineMailboxForDrain(items: OfflineMailboxQueueItem[]): OfflineMailboxQueueItem[] {
  return [...items].sort((a, b) => {
    const d = a.clientOutSeq - b.clientOutSeq
    return d !== 0 ? d : a.createdAt - b.createdAt
  })
}

export function backoffMsForDrainAttempt(attempts: number): number {
  return Math.min(120_000, 1500 * Math.pow(2, Math.min(attempts, 8)))
}

/** `true`, wenn dieser Eintrag wegen Backoff noch nicht erneut versucht werden soll. */
export function shouldDeferDrainAttempt(item: OfflineMailboxQueueItem, now: number): boolean {
  if (item.attempts <= 0) return false
  const wait = backoffMsForDrainAttempt(item.attempts)
  return now - item.lastAttemptAt < wait
}

export type EnqueueOfflineMailboxPureResult =
  | { ok: true; queued: true; items: OfflineMailboxQueueItem[] }
  | { ok: true; queued: false; items: OfflineMailboxQueueItem[] }
  | { ok: false; queued: false; reason: string }

/**
 * Reine Enqueue-Logik: kein Speicher, kein Netz.
 * `id` und `now` kommen vom Caller (z. B. `crypto.randomUUID` / `Date.now`).
 */
export function tryEnqueueOfflineMailboxItem(params: {
  items: OfflineMailboxQueueItem[]
  kind: OfflineMailboxKind
  recipient: string
  payload: string
  encrypted: boolean
  timeIsTrusted: boolean
  lastError?: string
  id: string
  now: number
}): EnqueueOfflineMailboxPureResult {
  const { items, kind, recipient, payload, encrypted, timeIsTrusted, lastError, id, now } = params
  if (payload.length > OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS) {
    return { ok: false, queued: false, reason: 'Nutzlaste zu groß für lokale Warteschlange.' }
  }
  const dedup = offlineMailboxDedupKey({ kind, recipient, encrypted, payload })
  if (items.some((q) => offlineMailboxDedupKey(q) === dedup)) {
    return { ok: true, queued: false, items }
  }
  const next: OfflineMailboxQueueItem = {
    id,
    kind,
    status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
    recipient: recipient.trim(),
    payload,
    encrypted,
    timeIsTrusted,
    clientOutSeq: maxClientOutSeqIn(items) + 1,
    createdAt: now,
    attempts: 0,
    lastAttemptAt: 0,
    ...(lastError !== undefined ? { lastError } : {}),
  }
  return { ok: true, queued: true, items: [...items, next] }
}
