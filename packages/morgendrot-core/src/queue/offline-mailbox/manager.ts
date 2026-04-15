import type { ClockPort } from '../../ports/clock.js'
import type { IdGeneratorPort } from '../../ports/id-generator.js'
import type { StringStoragePort } from '../../ports/storage.js'
import { OFFLINE_MAILBOX_QUEUE_STORAGE_KEY, type OfflineMailboxKind, type OfflineMailboxQueueItem } from './model.js'
import { parseOfflineMailboxQueueFromJson, serializeOfflineMailboxQueueToJson } from './codec.js'
import { nextClientOutSeqFromItems, tryEnqueueOfflineMailboxItem } from './state.js'

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
 * Orchestriert **Laden/Speichern** und **Enqueue** über Ports (kein `fetch`, kein `/send`).
 * Drain bleibt im Adapter (Netz); Backoff/Defer-Hilfen: `state.ts`.
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
  function enqueueFailure(opts: {
    kind: OfflineMailboxKind
    recipient: string
    payload: string
    encrypted: boolean
    timeIsTrusted: boolean
    lastError?: string
  }): EnqueueOfflineMailboxFailureResult {
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
    })
    if (!r.ok) {
      return { ok: false, queued: false, reason: r.reason }
    }
    if (r.queued) {
      save(r.items)
    }
    return { ok: true, queued: r.queued }
  }

  return { load, save, nextClientOutSeq, count, enqueueFailure }
}

export type OfflineMailboxManager = ReturnType<typeof createOfflineMailboxManager>
