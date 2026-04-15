import type { OfflineMailboxQueueItem } from './model.js'
import type { OfflineMailboxSendPort } from './send-port.js'
import { shouldDeferDrainAttempt, bumpOfflineMailboxItemAfterFailedSend } from './state.js'

/**
 * Ein Drain-Durchlauf über **bereits sortierte** Items (typ. `sortOfflineMailboxForDrain`).
 * Backoff/Defer und Fehler-Bump sind im Core; Netz nur über `send`.
 */
export async function drainOfflineMailboxOnce(
  sortedItems: OfflineMailboxQueueItem[],
  nowMs: number,
  send: OfflineMailboxSendPort
): Promise<{ kept: OfflineMailboxQueueItem[]; sent: number; failed: number }> {
  const kept: OfflineMailboxQueueItem[] = []
  let sent = 0
  let failed = 0

  for (const item of sortedItems) {
    if (shouldDeferDrainAttempt(item, nowMs)) {
      kept.push(item)
      continue
    }

    const result =
      item.kind === 'encrypted_send'
        ? await send.sendEncrypted(item.payload)
        : await send.sendPlain(item.recipient, item.payload)

    if (result.ok) {
      sent++
    } else {
      failed++
      kept.push(bumpOfflineMailboxItemAfterFailedSend(item, result.error, nowMs))
    }
  }

  return { kept, sent, failed }
}
