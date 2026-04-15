'use client'

/**
 * § H.3g **Paket 7 — Vorbereitung:** Client-Mailbox-Outbox (fehlgeschlagene `/send` / `/send-plain`).
 *
 * Orchestrierung: **`createOfflineMailboxManager`** + **`OfflineMailboxTrySend`** (aus **`OfflineMailboxSendPort`**, `@morgendrot/core`).
 * Diese Datei: **Browser-Storage**, **Opt-in**, **Send-Adapter** (`chat-commands`).
 */

import { sendMessage, sendEncryptedMessageWithTimeout } from './chat-commands'
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
  canUseDirectPlaintextMailboxDrain,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import {
  isDirectMailboxDrainEnabled,
  isIotaRelayOnlyMode,
  trySubmitPlaintextMailboxViaDirectIota,
} from '@/frontend/lib/direct-iota-plain-submit'

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

function createChatCommandsSendPort(): OfflineMailboxSendPort {
  return {
    async sendEncrypted(payload: string) {
      const r = await sendEncryptedMessageWithTimeout(payload)
      return {
        ok: r.ok === true,
        error: r.error ?? (r as { message?: string }).message,
      }
    },
    async sendPlain(recipient: string, payload: string) {
      const r = await sendMessage(recipient, payload, false)
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
      return { ok: false as const, error: r.error }
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
