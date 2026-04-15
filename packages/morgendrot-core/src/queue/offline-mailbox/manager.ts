import type { ClockPort } from '../../ports/clock.js'
import type { IdGeneratorPort } from '../../ports/id-generator.js'
import type { StringStoragePort } from '../../ports/storage.js'
import { OFFLINE_MAILBOX_QUEUE_STORAGE_KEY, type OfflineMailboxKind, type OfflineMailboxQueueItem } from './model.js'
import { parseOfflineMailboxQueueFromJson, serializeOfflineMailboxQueueToJson } from './codec.js'
import { nextClientOutSeqFromItems, tryEnqueueOfflineMailboxItem, sortOfflineMailboxForDrain } from './state.js'
import { drainOfflineMailboxOnce } from './drain.js'
import type { OfflineMailboxSendPort } from './send-port.js'
import { computeCanonicalMsgRefV1 } from './canonical-msg-ref.js'

export type EnqueueOfflineMailboxFailureResult =
  | { ok: true; queued: true }
  | { ok: true; queued: false }
  | { ok: false; queued: false; reason: string }

export type OfflineMailboxManagerDeps = {
  storage: StringStoragePort
  clock: ClockPort
  ids: IdGeneratorPort
  /** Standard: kanonischer `localStorage`-Key der PWA. */
  queueStorageKey?: string
}

/**
 * Orchestriert **Laden/Speichern**, **Enqueue** und **Drain** über Ports.
 * Netz nur über **`OfflineMailboxSendPort`** (`drainOnce`).
 */
export function createOfflineMailboxManager(deps: OfflineMailboxManagerDeps) {
  const key = deps.queueStorageKey ?? OFFLINE_MAILBOX_QUEUE_STORAGE_KEY

  function load(): OfflineMailboxQueueItem[] {
    return parseOfflineMailboxQueueFromJson(deps.storage.getItem(key))
  }

  function save(items: OfflineMailboxQueueItem[]): void {
    deps.storage.setItem(key, serializeOfflineMailboxQueueToJson(items))
  }

  function nextClientOutSeq(): number {
    return nextClientOutSeqFromItems(load())
  }

  function count(): number {
    return load().length
  }

  /**
   * Enqueue mit persistiertem Zustand bei Erfolg / Duplikat ohne Schreiben.
   * Feature-Flags (Opt-in) prüft der **Caller**.
   */
  async function enqueueFailure(opts: {
    kind: OfflineMailboxKind
    recipient: string
    payload: string
    encrypted: boolean
    timeIsTrusted: boolean
    lastError?: string
    /** Absender-Wallet (§ H.12); leer = Legacy-Verhalten im Ref-Input. */
    senderAddress?: string
    threadId?: string
    messageNonceU64?: bigint
  }): Promise<EnqueueOfflineMailboxFailureResult> {
    const canonicalMsgRef = await computeCanonicalMsgRefV1({
      senderAddress: opts.senderAddress,
      recipientAddress: opts.recipient,
      threadId: opts.threadId,
      messageNonceU64: opts.messageNonceU64,
      payloadUtf8: opts.payload,
    })
    const cur = load()
    const r = tryEnqueueOfflineMailboxItem({
      items: cur,
      kind: opts.kind,
      recipient: opts.recipient,
      payload: opts.payload,
      encrypted: opts.encrypted,
      timeIsTrusted: opts.timeIsTrusted,
      lastError: opts.lastError,
      id: deps.ids.randomId(),
      now: deps.clock.now(),
      canonicalMsgRef,
    })
    if (!r.ok) {
      return { ok: false, queued: false, reason: r.reason }
    }
    if (r.queued) {
      save(r.items)
    }
    return { ok: true, queued: r.queued }
  }

  /**
   * Ein vollständiger Drain-Durchlauf: sortiert, sendet über `send`, persistiert `kept`.
   */
  async function drainOnce(send: OfflineMailboxSendPort): Promise<{
    sent: number
    failed: number
    remaining: number
  }> {
    const sorted = sortOfflineMailboxForDrain(load())
    if (sorted.length === 0) {
      return { sent: 0, failed: 0, remaining: 0 }
    }
    const now = deps.clock.now()
    const { kept, sent, failed } = await drainOfflineMailboxOnce(sorted, now, send)
    save(kept)
    return { sent, failed, remaining: kept.length }
  }

  return { load, save, nextClientOutSeq, count, enqueueFailure, drainOnce }
}

export type OfflineMailboxManager = ReturnType<typeof createOfflineMailboxManager>
