import type { OfflineMailboxQueueItem } from './model'
import type { OfflineMailboxTrySend } from './send-port'
import { shouldDeferDrainAttempt, bumpOfflineMailboxItemAfterFailedSend, sortOfflineMailboxForDrain } from './state'

/**
 * Ein Drain-Durchlauf über **bereits sortierte** Items (typ. `sortOfflineMailboxForDrain`).
 * Backoff/Defer und Fehler-Bump sind im Core; Netz nur über **`trySend`**.
 */
export async function drainOfflineMailboxOnce(
  sortedItems: OfflineMailboxQueueItem[],
  nowMs: number,
  trySend: OfflineMailboxTrySend
): Promise<{ kept: OfflineMailboxQueueItem[]; sent: number; failed: number }> {
  const kept: OfflineMailboxQueueItem[] = []
  let sent = 0
  let failed = 0

  for (const item of sortedItems) {
    if (shouldDeferDrainAttempt(item, nowMs)) {
      kept.push(item)
      continue
    }

    const result = await trySend(item)

    if (result.ok) {
      sent++
    } else {
      failed++
      kept.push(bumpOfflineMailboxItemAfterFailedSend(item, result.error, nowMs))
    }
  }

  return { kept, sent, failed }
}

export type OfflineMailboxDrainCycleDeps = {
  load: () => OfflineMailboxQueueItem[]
  save: (items: OfflineMailboxQueueItem[]) => void
  nowMs: number
}

/**
 * Lädt, sortiert, ein Drain-Durchlauf, speichert — Orchestrierung im Core (testbar mit In-Memory-`load`/`save`).
 */
export async function runOfflineMailboxDrainCycle(
  deps: OfflineMailboxDrainCycleDeps,
  trySend: OfflineMailboxTrySend
): Promise<{ sent: number; failed: number; remaining: number }> {
  const sorted = sortOfflineMailboxForDrain(deps.load())
  if (sorted.length === 0) {
    return { sent: 0, failed: 0, remaining: 0 }
  }
  const { kept, sent, failed } = await drainOfflineMailboxOnce(sorted, deps.nowMs, trySend)
  deps.save(kept)
  return { sent, failed, remaining: kept.length }
}
