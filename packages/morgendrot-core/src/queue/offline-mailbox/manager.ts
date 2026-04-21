import type { ClockPort } from '../../ports/clock'
import type { IdGeneratorPort } from '../../ports/id-generator'
import type { StringStoragePort } from '../../ports/storage'
import { OFFLINE_MAILBOX_QUEUE_STORAGE_KEY, type OfflineMailboxKind, type OfflineMailboxQueueItem } from './model'
import { parseOfflineMailboxQueueFromJson, serializeOfflineMailboxQueueToJson } from './codec'
import { nextClientOutSeqFromItems, tryEnqueueOfflineMailboxItem } from './state'
import { runOfflineMailboxDrainCycle } from './drain'
import type { OfflineMailboxDrainOnceArg } from './send-port'
import { coerceOfflineMailboxTrySend } from './send-port'
import { computeCanonicalMsgRefV1 } from './canonical-msg-ref'

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
    priority?: number
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
      priority: opts.priority,
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
   * Ein vollständiger Drain-Zyklus: **`runOfflineMailboxDrainCycle`** mit Storage dieses Managers.
   * Argument: **`OfflineMailboxTrySend`** oder klassischer **`OfflineMailboxSendPort`** (wird gewrappt).
   */
  async function drainOnce(sendPortOrTrySend: OfflineMailboxDrainOnceArg): Promise<{
    sent: number
    failed: number
    remaining: number
  }> {
    const trySend = coerceOfflineMailboxTrySend(sendPortOrTrySend)
    return runOfflineMailboxDrainCycle({ load, save, nowMs: deps.clock.now() }, trySend)
  }

  return { load, save, nextClientOutSeq, count, enqueueFailure, drainOnce }
}

export type OfflineMailboxManager = ReturnType<typeof createOfflineMailboxManager>
