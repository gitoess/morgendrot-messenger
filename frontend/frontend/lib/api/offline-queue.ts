'use client'

/**
 * § H.3g **Paket 7 — Vorbereitung:** Client-Mailbox-Outbox (fehlgeschlagene `/send` / `/send-plain`).
 *
 * Orchestrierung **Laden/Speichern/Enqueue:** `createOfflineMailboxManager` aus **`@morgendrot/core`**.
 * Diese Datei: **Browser-Ports** (`localStorage`), **Opt-in**, **Drain** über `chat-commands`.
 */

import { sendMessage, sendEncryptedMessageWithTimeout } from './chat-commands'
import type { OfflineMailboxKind, OfflineMailboxQueueItem } from '@morgendrot/core'
import {
  sortOfflineMailboxForDrain,
  shouldDeferDrainAttempt,
  bumpOfflineMailboxItemAfterFailedSend,
  createOfflineMailboxManager,
  createNullableDelegatingStorage,
  createSystemClock,
  createCryptoUuidIdGenerator,
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

let mailboxManager: ReturnType<typeof createOfflineMailboxManager> | null = null

function getMailboxManager(): ReturnType<typeof createOfflineMailboxManager> {
  if (!mailboxManager) {
    mailboxManager = createOfflineMailboxManager({
      storage: createNullableDelegatingStorage(() =>
        typeof window === 'undefined' ? null : localStorage
      ),
      clock: createSystemClock(),
      ids: createCryptoUuidIdGenerator(),
    })
  }
  return mailboxManager
}

export function loadOfflineMailboxQueue() {
  return getMailboxManager().load()
}

export function saveOfflineMailboxQueue(items: OfflineMailboxQueueItem[]): void {
  getMailboxManager().save(items)
}

export function getOfflineMailboxQueueCount(): number {
  return getMailboxManager().count()
}

export function nextOfflineMailboxClientOutSeq(): number {
  return getMailboxManager().nextClientOutSeq()
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
  return getMailboxManager().enqueueFailure(opts)
}

export async function drainOfflineMailboxQueue(): Promise<{
  sent: number
  failed: number
  remaining: number
}> {
  if (!isOfflineMailboxQueueEnabled()) {
    return { sent: 0, failed: 0, remaining: 0 }
  }
  const mgr = getMailboxManager()
  const items = sortOfflineMailboxForDrain(mgr.load())
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
      kept.push(bumpOfflineMailboxItemAfterFailedSend(item, err, Date.now()))
    }
  }

  mgr.save(kept)
  return { sent, failed, remaining: kept.length }
}
