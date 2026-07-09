'use client'

/**
 * § H.3g **Paket 7 — Vorbereitung:** Client-Mailbox-Outbox (fehlgeschlagene `/send` / `/send-plain`).
 * **§ H.15 Stufe 3:** Kanonische Queue-Logik nur in **`@morgendrot/core`** — diese Datei bleibt ein **dünner**
 * Browser-Adapter (`localStorage`, Hybrid-Send: Klartext/Verschlüsselt zuerst **`trySubmit*ViaDirectIota`**, bei Fehler **Relay** `/api`).
 * Keine zweite Settlement-/Dedup-Implementierung; Abgleich **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8.
 *
 * Orchestrierung: **`createOfflineMailboxManager`** + **`OfflineMailboxTrySend`** (aus **`OfflineMailboxSendPort`**, `@morgendrot/core`).
 */

import { sendPlaintextMailboxHybrid, sendPreEncryptedMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import { readMessagingPersistenceModeFromStorage } from '@/frontend/lib/messaging-persistence-mode'
import {
  isLegacyPlaintextEncryptedQueuePayload,
  isOfflineEncryptedWirePayload,
} from '@/frontend/lib/offline-mailbox-encrypted-payload'
import type { OfflineMailboxKind, OfflineMailboxQueueItem, OfflineMailboxTrySend } from '@morgendrot/core'
import {
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
  computeCanonicalMsgRefV1,
  stableOfflineMailboxThreadId,
  normalizeMailboxAddressUtf8,
  type ComputeCanonicalMsgRefV1Input,
  parseMailboxOutNonceMarker,
  prependMailboxOutNonceMarker,
  parseMailboxProtocolNonceU64FromWire,
  type ParsedMailboxOutNonce,
  shouldDeferDrainAttempt,
  backoffMsForDrainAttempt,
} from '@morgendrot/core'

export type EnqueueOfflineMailboxResult =
  | { ok: true; queued: true }
  | { ok: true; queued: false }
  | { ok: false; queued: false; reason: string }

export const OFFLINE_MAILBOX_QUEUE_OPT_IN_KEY = 'morgendrot.offlineMailboxQueue'

export function isOfflineMailboxQueueEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(OFFLINE_MAILBOX_QUEUE_OPT_IN_KEY) === '1'
  } catch {
    return false
  }
}

export function enableOfflineMailboxQueue(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(OFFLINE_MAILBOX_QUEUE_OPT_IN_KEY, '1')
    window.dispatchEvent(new CustomEvent('morgendrot.offlinePrefsChanged'))
  } catch {
    // optional
  }
}

function createHybridOfflineMailboxTrySend(): OfflineMailboxTrySend {
  return async (item) => {
    const mode = readMessagingPersistenceModeFromStorage()
    if (item.kind === 'plain_send' && item.encrypted === false) {
      const r = await sendPlaintextMailboxHybrid(item.recipient, item.payload, BigInt(item.clientOutSeq), {
        messagingPersistenceMode: mode,
      })
      if (r.ok) return { ok: true as const }
      return { ok: false as const, error: r.error ?? r.message ?? 'Klartext fehlgeschlagen' }
    }
    if (item.kind === 'encrypted_send' && item.encrypted === true) {
      if (
        isLegacyPlaintextEncryptedQueuePayload(item.kind, item.encrypted, item.payload) ||
        !isOfflineEncryptedWirePayload(item.payload)
      ) {
        return {
          ok: false as const,
          error:
            'Veralteter verschlüsselter Queue-Eintrag (Klartext) — wurde verworfen. Nachricht bitte erneut senden.',
        }
      }
      const r = await sendPreEncryptedMailboxHybrid(item.recipient, item.payload, {
        messagingPersistenceMode: mode,
      })
      if (r.ok) return { ok: true as const }
      return { ok: false as const, error: r.error ?? r.message ?? 'Verschlüsselt fehlgeschlagen' }
    }
    return { ok: false as const, error: 'Unbekannter Queue-Typ.' }
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
  purgeInsecureEncryptedQueueItems()
  return getMailboxManager().load()
}

/**
 * Entfernt `encrypted_send`-Einträge ohne Ciphertext-Wire v1 (Legacy-Klartext in localStorage).
 * @returns Anzahl verworfener Einträge
 */
export function purgeInsecureEncryptedQueueItems(): number {
  const mgr = getMailboxManager()
  const items = mgr.load()
  const kept = items.filter(
    (item) =>
      !isLegacyPlaintextEncryptedQueuePayload(item.kind, item.encrypted, item.payload)
  )
  const purged = items.length - kept.length
  if (purged > 0) mgr.save(kept)
  return purged
}

export function saveOfflineMailboxQueue(items: OfflineMailboxQueueItem[]): void {
  getMailboxManager().save(items)
}

/** Netzwechsel: Queue-Einträge mit alter Package-ID verwerfen. */
export function clearOfflineMailboxQueue(): number {
  const n = getOfflineMailboxQueueCount()
  saveOfflineMailboxQueue([])
  return n
}

export function getOfflineMailboxQueueCount(): number {
  return getMailboxManager().count()
}

export function nextOfflineMailboxClientOutSeq(): number {
  return getMailboxManager().nextClientOutSeq()
}

/** Eindeutige Chain-Nonce (ms) — nicht `nextOfflineMailboxClientOutSeq()` (startet bei leerer Queue immer bei 1). */
export function nextChainMessageNonceU64(): bigint {
  const seq = nextOfflineMailboxClientOutSeq()
  return BigInt(Math.max(Date.now(), seq))
}

/**
 * Speichert einen fehlgeschlagenen Mailbox-Versuch — nur wenn **Opt-in** aktiv und Nutzlast klein genug.
 */
export async function enqueueOfflineMailboxFailure(opts: {
  kind: OfflineMailboxKind
  recipient: string
  payload: string
  encrypted: boolean
  /** § H.6c: `true` = `DeviceTimeTrustLevel` „high“ beim Enqueue (Caller: typ. `!deviceTimeTrustWarn`). */
  timeIsTrusted: boolean
  lastError?: string
  /** § H.12 — Absender; Default leer (Core leitet Nonce aus Nutzlast ab). */
  senderAddress?: string
  threadId?: string
  messageNonceU64?: bigint
  /** Drain-Priorität (kleiner = früher). Ohne Wert: Core-Default (aktuell 100). */
  priority?: number
}): Promise<EnqueueOfflineMailboxResult> {
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
  return getMailboxManager().drainOnce(createHybridOfflineMailboxTrySend())
}
