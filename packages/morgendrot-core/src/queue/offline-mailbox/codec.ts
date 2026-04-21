import {
  OFFLINE_MAILBOX_PRIORITY_DEFAULT,
  OFFLINE_MAILBOX_MAX_ITEMS,
  type OfflineMailboxQueueItem,
} from './model'

/**
 * Normalisiert ein JSON-Objekt zu `OfflineMailboxQueueItem` oder `null`.
 * `timeIsTrusted`: nur exakt `true` akzeptiert, sonst `false` (Legacy).
 */
export function normalizeOfflineMailboxItem(o: Record<string, unknown>): OfflineMailboxQueueItem | null {
  if (
    typeof o.id !== 'string' ||
    (o.kind !== 'encrypted_send' && o.kind !== 'plain_send') ||
    typeof o.status !== 'string' ||
    typeof o.recipient !== 'string' ||
    typeof o.payload !== 'string' ||
    typeof o.encrypted !== 'boolean' ||
    typeof o.createdAt !== 'number' ||
    typeof o.attempts !== 'number' ||
    typeof o.lastAttemptAt !== 'number'
  ) {
    return null
  }
  const lastError = o.lastError
  let canonicalMsgRef: string | undefined
  if (typeof o.canonicalMsgRef === 'string') {
    const cr = o.canonicalMsgRef.trim().toLowerCase()
    if (/^[0-9a-f]{64}$/.test(cr)) canonicalMsgRef = cr
  }
  const rawSeq = o.clientOutSeq
  const clientOutSeq =
    typeof rawSeq === 'number' && Number.isFinite(rawSeq) && rawSeq >= 0 && Math.floor(rawSeq) === rawSeq
      ? rawSeq
      : 0
  const rawPrio = o.priority
  const priority =
    typeof rawPrio === 'number' && Number.isFinite(rawPrio) && rawPrio >= 0
      ? Math.floor(rawPrio)
      : OFFLINE_MAILBOX_PRIORITY_DEFAULT
  return {
    id: o.id,
    kind: o.kind,
    status: o.status as OfflineMailboxQueueItem['status'],
    recipient: o.recipient,
    payload: o.payload,
    encrypted: o.encrypted,
    timeIsTrusted: o.timeIsTrusted === true,
    clientOutSeq,
    createdAt: o.createdAt,
    attempts: o.attempts,
    lastAttemptAt: o.lastAttemptAt,
    priority,
    ...(typeof lastError === 'string' ? { lastError } : {}),
    ...(canonicalMsgRef !== undefined ? { canonicalMsgRef } : {}),
  }
}

/** Parst gespeicherten JSON-Array-String; defensiv bei Fehlern → `[]`. */
export function parseOfflineMailboxQueueFromJson(raw: string | null): OfflineMailboxQueueItem[] {
  if (!raw) return []
  try {
    const a = JSON.parse(raw) as unknown
    if (!Array.isArray(a)) return []
    const out: OfflineMailboxQueueItem[] = []
    for (const x of a) {
      if (x == null || typeof x !== 'object') continue
      const n = normalizeOfflineMailboxItem(x as Record<string, unknown>)
      if (n) out.push(n)
    }
    return out
  } catch {
    return []
  }
}

/** Serialisiert die Queue; kürzt auf `OFFLINE_MAILBOX_MAX_ITEMS` (wie bisheriges `save`). */
export function serializeOfflineMailboxQueueToJson(items: OfflineMailboxQueueItem[]): string {
  return JSON.stringify(items.slice(0, OFFLINE_MAILBOX_MAX_ITEMS))
}
