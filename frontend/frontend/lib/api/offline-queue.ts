'use client'

/**
 * § H.3g **Paket 7 — Vorbereitung:** Client-Mailbox-Outbox (fehlgeschlagene `/send` / `/send-plain`).
 *
 * - **Nicht** die Boss-/Settlement-„Offline-Relay-Queue“ (`src/settlement-queue.ts`, § **H.12**).
 * - **Nicht** der LoRa→IOTA-Delayed-Mirror (`lib/delayed-mirror-queue.ts`).
 * - Idempotenz / `canonical_msg_ref` bleiben **nach** § **H.12** + Delayed-Upload-MVP zu verzahnen — hier nur stabile `id` + Dedup-Key.
 *
 * **Opt-in:** `localStorage` **`morgendrot.offlineMailboxQueue`** = **`1`** (Default: aus).
 * Persistenz: `localStorage` (MVP); später IndexedDB/SQLite möglich, ohne dieses API-Shape zu brechen.
 *
 * **Risiko:** `payload` entspricht den **Command-Args** — kann Klartext, Wire mit Anhang o. Ä. enthalten.
 * Nur auf **vertrauten** Geräten aktivieren.
 *
 * **§ H.6c / Forensic-Vorbereitung:** `timeIsTrusted` = **„high“**-Zeitvertrauen zum **Enqueue**-Zeitpunkt
 * (frischer plausibler Server-`Date`-Poll **oder** verifizierter GPS-UTC-Fix), vgl. `inferDeviceTimeTrust` in **`device-time-trust.ts`**.
 * Legacy-Einträge ohne Feld gelten als **`false`** (ehrlich: unbekannt).
 */

import { sendMessage, sendEncryptedMessageWithTimeout } from './chat-commands'

const STORAGE_KEY = 'morgendrot.offline-mailbox-queue.v1'
const MAX_ITEMS = 60
const MAX_PAYLOAD_CHARS = 512_000

/** Persistiert; `syncing` / `sent` sind für UI/Drain-Logik reserviert (MVP: Einträge werden bei Erfolg entfernt). */
export const OFFLINE_QUEUE_ITEM_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SENT: 'sent',
} as const

export type OfflineQueueItemStatus =
  (typeof OFFLINE_QUEUE_ITEM_STATUS)[keyof typeof OFFLINE_QUEUE_ITEM_STATUS]

export type OfflineMailboxKind = 'encrypted_send' | 'plain_send'

export type OfflineMailboxQueueItem = {
  id: string
  kind: OfflineMailboxKind
  status: OfflineQueueItemStatus
  recipient: string
  /** Ein Argument an `/send` bzw. Klartextteil für `/send-plain`. */
  payload: string
  encrypted: boolean
  /**
   * `true` nur bei **DeviceTimeTrustLevel `high`** (§ H.6c): frischer plausibler HTTP-`Date` vom Status-Poll
   * oder verifizierter GPS-UTC-Fix — nicht bloß `navigator.onLine`.
   */
  timeIsTrusted: boolean
  createdAt: number
  attempts: number
  lastAttemptAt: number
  lastError?: string
}

export function isOfflineMailboxQueueEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('morgendrot.offlineMailboxQueue') === '1'
  } catch {
    return false
  }
}

function normalizeOfflineMailboxItem(o: Record<string, unknown>): OfflineMailboxQueueItem | null {
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
  return {
    id: o.id,
    kind: o.kind,
    status: o.status as OfflineMailboxQueueItem['status'],
    recipient: o.recipient,
    payload: o.payload,
    encrypted: o.encrypted,
    timeIsTrusted: o.timeIsTrusted === true,
    createdAt: o.createdAt,
    attempts: o.attempts,
    lastAttemptAt: o.lastAttemptAt,
    ...(typeof lastError === 'string' ? { lastError } : {}),
  }
}

function safeParse(raw: string | null): OfflineMailboxQueueItem[] {
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

export function loadOfflineMailboxQueue(): OfflineMailboxQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

export function saveOfflineMailboxQueue(items: OfflineMailboxQueueItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    /* quota */
  }
}

export function offlineMailboxDedupKey(item: {
  kind: OfflineMailboxKind
  recipient: string
  encrypted: boolean
  payload: string
}): string {
  const head = item.payload.slice(0, 2048)
  return `${item.kind}|${item.recipient}|${item.encrypted}|${item.payload.length}|${head}`
}

export function getOfflineMailboxQueueCount(): number {
  return loadOfflineMailboxQueue().length
}

function backoffMs(attempts: number): number {
  return Math.min(120_000, 1500 * Math.pow(2, Math.min(attempts, 8)))
}

export type EnqueueOfflineMailboxResult =
  | { ok: true; queued: true }
  | { ok: true; queued: false }
  | { ok: false; queued: false; reason: string }

/**
 * Speichert einen fehlgeschlagenen Mailbox-Versuch — nur wenn **Opt-in** aktiv und Nutzlast klein genug.
 */
export function enqueueOfflineMailboxFailure(opts: {
  kind: OfflineMailboxKind
  recipient: string
  payload: string
  encrypted: boolean
  /** § H.6c: `true` = `DeviceTimeTrustLevel` „high“ beim Enqueue (Caller: typ. `!deviceTimeTrustWarn`). */
  timeIsTrusted: boolean
  lastError?: string
}): EnqueueOfflineMailboxResult {
  if (!isOfflineMailboxQueueEnabled()) {
    return { ok: true, queued: false }
  }
  const { kind, recipient, payload, encrypted, timeIsTrusted, lastError } = opts
  if (payload.length > MAX_PAYLOAD_CHARS) {
    return { ok: false, queued: false, reason: 'Nutzlaste zu groß für lokale Warteschlange.' }
  }
  const cur = loadOfflineMailboxQueue()
  const dedup = offlineMailboxDedupKey({ kind, recipient, encrypted, payload })
  if (cur.some((q) => offlineMailboxDedupKey(q) === dedup)) {
    return { ok: true, queued: false }
  }
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const next: OfflineMailboxQueueItem = {
    id,
    kind,
    status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
    recipient: recipient.trim(),
    payload,
    encrypted,
    timeIsTrusted,
    createdAt: Date.now(),
    attempts: 0,
    lastAttemptAt: 0,
    lastError,
  }
  cur.push(next)
  saveOfflineMailboxQueue(cur)
  return { ok: true, queued: true }
}

export async function drainOfflineMailboxQueue(): Promise<{
  sent: number
  failed: number
  remaining: number
}> {
  if (!isOfflineMailboxQueueEnabled()) {
    return { sent: 0, failed: 0, remaining: 0 }
  }
  const items = loadOfflineMailboxQueue().sort((a, b) => a.createdAt - b.createdAt)
  if (items.length === 0) return { sent: 0, failed: 0, remaining: 0 }

  const now = Date.now()
  const kept: OfflineMailboxQueueItem[] = []
  let sent = 0
  let failed = 0

  for (const item of items) {
    const wait = backoffMs(item.attempts)
    if (item.attempts > 0 && now - item.lastAttemptAt < wait) {
      kept.push(item)
      continue
    }

    let ok = false
    let err: string | undefined
    if (item.kind === 'encrypted_send') {
      const r = await sendEncryptedMessageWithTimeout(item.payload)
      ok = r.ok === true
      err = r.error || (r as { message?: string }).message
    } else {
      const r = await sendMessage(item.recipient, item.payload, false)
      ok = r.ok === true
      err = r.error || (r as { message?: string }).message
    }

    if (ok) {
      sent++
    } else {
      failed++
      kept.push({
        ...item,
        status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
        attempts: item.attempts + 1,
        lastAttemptAt: Date.now(),
        lastError: typeof err === 'string' ? err : String(err),
      })
    }
  }

  saveOfflineMailboxQueue(kept)
  return { sent, failed, remaining: kept.length }
}
