'use client'

/**
 * § H.3g **Paket 7 — Vorbereitung:** Client-Mailbox-Outbox (fehlgeschlagene `/send` / `/send-plain`).
 * **§ H.15 Stufe 3:** Kanonische Queue-Logik nur in **`@morgendrot/core`** — diese Datei bleibt ein **dünner**
 * Browser-Adapter (`localStorage`, Hybrid-Send: Klartext/Verschlüsselt zuerst **`trySubmit*ViaDirectIota`**, bei Fehler **Relay** `/api`).
 * Keine zweite Settlement-/Dedup-Implementierung; Abgleich **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8.
 *
 * Orchestrierung: **`createOfflineMailboxManager`** + **`OfflineMailboxTrySend`** (aus **`OfflineMailboxSendPort`**, `@morgendrot/core`).
 */

import { sendMessage, sendEncryptedMessageWithTimeout } from './chat-commands'
import { readMessagingPersistenceModeFromStorage } from '@/frontend/lib/messaging-persistence-mode'
import type { OfflineMailboxKind, OfflineMailboxQueueItem, OfflineMailboxTrySend } from '@morgendrot/core'
import type { OfflineMailboxSendPort } from '@morgendrot/core'
import {
  createOfflineMailboxManager,
  createNullableDelegatingStorage,
  createSystemClock,
  createCryptoUuidIdGenerator,
  offlineMailboxDedupKey,
  createOfflineMailboxTrySendFromSendPort,
} from '@morgendrot/core'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  canUseDirectEncryptedMailboxDrain,
  canUseDirectPlaintextMailboxDrain,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import {
  isDirectMailboxDrainEnabled,
  isIotaRelayOnlyMode,
  trySubmitPlaintextMailboxViaDirectIota,
} from '@/frontend/lib/direct-iota-plain-submit'
import { trySubmitEncryptedMailboxViaDirectIotaFromPlaintext } from '@/frontend/lib/direct-iota-encrypted-submit'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import { mergeDirectThenRelayErrors } from '@/frontend/lib/direct-iota-error-messages'

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

function createChatCommandsSendPort(): OfflineMailboxSendPort {
  return {
    async sendEncrypted(payload: string) {
      const r = await sendEncryptedMessageWithTimeout(payload, 120_000, {
        messagingPersistenceMode: readMessagingPersistenceModeFromStorage(),
      })
      return {
        ok: r.ok === true,
        error: r.error ?? (r as { message?: string }).message,
      }
    },
    async sendPlain(recipient: string, payload: string) {
      const r = await sendMessage(recipient, payload, false, {
        messagingPersistenceMode: readMessagingPersistenceModeFromStorage(),
      })
      return {
        ok: r.ok === true,
        error: r.error ?? (r as { message?: string }).message,
      }
    },
  }
}

function canAttemptDirectPlainMailbox(item: OfflineMailboxQueueItem): boolean {
  return (
    item.kind === 'plain_send' &&
    item.encrypted === false &&
    !isIotaRelayOnlyMode() &&
    isDirectMailboxDrainEnabled() &&
    Boolean(getConfiguredDirectIotaRpcUrl()) &&
    Boolean(getDirectIotaSessionSigner()) &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    canUseDirectPlaintextMailboxDrain()
  )
}

function canAttemptDirectEncryptedMailbox(item: OfflineMailboxQueueItem): boolean {
  return (
    item.kind === 'encrypted_send' &&
    item.encrypted === true &&
    !isIotaRelayOnlyMode() &&
    isDirectMailboxDrainEnabled() &&
    Boolean(getConfiguredDirectIotaRpcUrl()) &&
    Boolean(getDirectIotaSessionSigner()) &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    canUseDirectEncryptedMailboxDrain() &&
    getDirectChatEcdhMaterialForRecipient(item.recipient) != null
  )
}

function createHybridOfflineMailboxTrySend(): OfflineMailboxTrySend {
  const viaHttp = createOfflineMailboxTrySendFromSendPort(createChatCommandsSendPort())
  return async (item) => {
    if (canAttemptDirectPlainMailbox(item)) {
      const r = await trySubmitPlaintextMailboxViaDirectIota({
        recipient: item.recipient,
        payloadUtf8: item.payload,
        nonce: BigInt(item.clientOutSeq),
      })
      if (r.ok) return { ok: true as const }
      const httpR = await viaHttp(item)
      if (httpR.ok) return { ok: true as const }
      return { ok: false as const, error: mergeDirectThenRelayErrors(r.error, httpR.error) }
    }
    if (canAttemptDirectEncryptedMailbox(item)) {
      const mat = getDirectChatEcdhMaterialForRecipient(item.recipient)
      if (mat) {
        const r = await trySubmitEncryptedMailboxViaDirectIotaFromPlaintext({
          recipient: item.recipient,
          plaintextUtf8: item.payload,
          peerPubRaw: mat.peerPubRaw,
          ecdhPrivateKey: mat.ecdhPrivateKey,
        })
        if (r.ok) return { ok: true as const }
        const httpR = await viaHttp(item)
        if (httpR.ok) return { ok: true as const }
        return { ok: false as const, error: mergeDirectThenRelayErrors(r.error, httpR.error) }
      }
    }
    return viaHttp(item)
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
