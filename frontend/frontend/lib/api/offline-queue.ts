'use client'

/**
 * § H.3g **Paket 7 — Vorbereitung:** Client-Mailbox-Outbox (fehlgeschlagene `/send` / `/send-plain`).
 *
 * Domänenlogik: **`@morgendrot/core`** (`queue/offline-mailbox`). Diese Datei: **Speicher** (`localStorage`),
 * **Opt-in-Flag**, **Drain** über `chat-commands`.
 *
 * - **Nicht** die Boss-/Settlement-„Offline-Relay-Queue“ (`src/settlement-queue.ts`, § **H.12**).
 * - **Nicht** der LoRa→IOTA-Delayed-Mirror (`lib/delayed-mirror-queue.ts`).
 *
 * **Opt-in:** `localStorage` **`morgendrot.offlineMailboxQueue`** = **`1`** (Default: aus).
 */

import { sendMessage, sendEncryptedMessageWithTimeout } from './chat-commands'
import type { OfflineMailboxKind, OfflineMailboxQueueItem } from '@morgendrot/core'
import {
  OFFLINE_MAILBOX_QUEUE_STORAGE_KEY,
  OFFLINE_QUEUE_ITEM_STATUS,
  parseOfflineMailboxQueueFromJson,
  serializeOfflineMailboxQueueToJson,
  sortOfflineMailboxForDrain,
  shouldDeferDrainAttempt,
  tryEnqueueOfflineMailboxItem,
  nextClientOutSeqFromItems,
  offlineMailboxDedupKey,
} from '@morgendrot/core'

export {
  OFFLINE_MAILBOX_QUEUE_STORAGE_KEY,
  OFFLINE_MAILBOX_MAX_ITEMS,
  OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS,
  OFFLINE_QUEUE_ITEM_STATUS,
  type OfflineQueueItemStatus,
  type OfflineMailboxKind,
  type OfflineMailboxQueueItem,
  offlineMailboxDedupKey,
} from '@morgendrot/core'

export type EnqueueOfflineMailboxResult =
  | { ok: true; queued: true }
  | { ok: true; queued: false }
  | { ok: false; queued: false; reason: string }

export function isOfflineMailboxQueueEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('morgendrot.offlineMailboxQueue') === '1'
  } catch {
    return false
  }
}

function readRawQueue(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(OFFLINE_MAILBOX_QUEUE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function loadOfflineMailboxQueue() {
  return parseOfflineMailboxQueueFromJson(readRawQueue())
}

export function saveOfflineMailboxQueue(items: OfflineMailboxQueueItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OFFLINE_MAILBOX_QUEUE_STORAGE_KEY, serializeOfflineMailboxQueueToJson(items))
  } catch {
    /* quota */
  }
}

export function getOfflineMailboxQueueCount(): number {
  return loadOfflineMailboxQueue().length
}

export function nextOfflineMailboxClientOutSeq(): number {
  return nextClientOutSeqFromItems(loadOfflineMailboxQueue())
}

function newOfflineMailboxId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `ob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

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
  const cur = loadOfflineMailboxQueue()
  const r = tryEnqueueOfflineMailboxItem({
    items: cur,
    kind,
    recipient,
    payload,
    encrypted,
    timeIsTrusted,
    lastError,
    id: newOfflineMailboxId(),
    now: Date.now(),
  })
  if (!r.ok) {
    return { ok: false, queued: false, reason: r.reason }
  }
  if (r.queued) {
    saveOfflineMailboxQueue(r.items)
  }
  return { ok: true, queued: r.queued }
}

export async function drainOfflineMailboxQueue(): Promise<{
  sent: number
  failed: number
  remaining: number
}> {
  if (!isOfflineMailboxQueueEnabled()) {
    return { sent: 0, failed: 0, remaining: 0 }
  }
  const items = sortOfflineMailboxForDrain(loadOfflineMailboxQueue())
  if (items.length === 0) return { sent: 0, failed: 0, remaining: 0 }

  const now = Date.now()
  const kept: OfflineMailboxQueueItem[] = []
  let sent = 0
  let failed = 0

  for (const item of items) {
    if (shouldDeferDrainAttempt(item, now)) {
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
