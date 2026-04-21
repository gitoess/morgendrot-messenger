import {
  OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS,
  OFFLINE_MAILBOX_PRIORITY_DEFAULT,
  OFFLINE_QUEUE_ITEM_STATUS,
  type OfflineMailboxKind,
  type OfflineMailboxQueueItem,
} from './model'

const CANONICAL_MSG_REF_HEX_RE = /^[0-9a-f]{64}$/

export function offlineMailboxDedupKey(item: {
  kind: OfflineMailboxKind
  recipient: string
  encrypted: boolean
  payload: string
}): string {
  const head = item.payload.slice(0, 2048)
  return `${item.kind}|${item.recipient}|${item.encrypted}|${item.payload.length}|${head}`
}

/** Dedup: gleicher § H.12-Ref **oder** gleicher Legacy-Fingerprint (Migration / Parallel-Einträge). */
export function offlineMailboxEnqueueCollides(
  items: OfflineMailboxQueueItem[],
  candidate: {
    kind: OfflineMailboxKind
    recipient: string
    encrypted: boolean
    payload: string
    canonicalMsgRef: string
  }
): boolean {
  const normRef = candidate.canonicalMsgRef.toLowerCase()
  const legacyKey = offlineMailboxDedupKey(candidate)
  return items.some((q) => {
    const qr = q.canonicalMsgRef?.toLowerCase()
    if (qr && CANONICAL_MSG_REF_HEX_RE.test(qr) && qr === normRef) return true
    return offlineMailboxDedupKey(q) === legacyKey
  })
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

/** Sortierung für Drain: `priority` (kleiner zuerst), dann `createdAt`, dann `clientOutSeq`. */
export function sortOfflineMailboxForDrain(items: OfflineMailboxQueueItem[]): OfflineMailboxQueueItem[] {
  return [...items].sort((a, b) => {
    const p = (a.priority ?? OFFLINE_MAILBOX_PRIORITY_DEFAULT) - (b.priority ?? OFFLINE_MAILBOX_PRIORITY_DEFAULT)
    if (p !== 0) return p
    const c = a.createdAt - b.createdAt
    if (c !== 0) return c
    return a.clientOutSeq - b.clientOutSeq
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
  /** § H.12 — 64 Hex (Kleinbuchstaben), z. B. von `computeCanonicalMsgRefV1`. */
  canonicalMsgRef: string
  /** Kleinere Zahl = früherer Drain. */
  priority?: number
}): EnqueueOfflineMailboxPureResult {
  const { items, kind, recipient, payload, encrypted, timeIsTrusted, lastError, id, now, canonicalMsgRef } = params
  if (payload.length > OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS) {
    return { ok: false, queued: false, reason: 'Nutzlaste zu groß für lokale Warteschlange.' }
  }
  if (!CANONICAL_MSG_REF_HEX_RE.test(canonicalMsgRef.toLowerCase())) {
    return { ok: false, queued: false, reason: 'canonicalMsgRef muss 64 Hexzeichen sein.' }
  }
  const normRef = canonicalMsgRef.toLowerCase()
  if (offlineMailboxEnqueueCollides(items, { kind, recipient, encrypted, payload, canonicalMsgRef: normRef })) {
    return { ok: true, queued: false, items }
  }
  const priority =
    typeof params.priority === 'number' && Number.isFinite(params.priority) && params.priority >= 0
      ? Math.floor(params.priority)
      : OFFLINE_MAILBOX_PRIORITY_DEFAULT
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
    priority,
    canonicalMsgRef: normRef,
    ...(lastError !== undefined ? { lastError } : {}),
  }
  return { ok: true, queued: true, items: [...items, next] }
}

/** Nach fehlgeschlagenem Sendeversuch (Drain): Versuchszähler + Fehlertext — rein, ohne Netz. */
export function bumpOfflineMailboxItemAfterFailedSend(
  item: OfflineMailboxQueueItem,
  err: unknown,
  now: number
): OfflineMailboxQueueItem {
  return {
    ...item,
    status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
    attempts: item.attempts + 1,
    lastAttemptAt: now,
    lastError: typeof err === 'string' ? err : String(err),
  }
}
