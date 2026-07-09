/**
 * Abstraktion für `/send` bzw. `/send-plain` — injizierbar (PWA: `executeCommand`, Tests: Mocks).
 */
import type { OfflineMailboxQueueItem } from './model'

export type MailboxSendResult = { ok: true } | { ok: false; error?: string }

export type OfflineMailboxSendPort = {
  sendEncrypted(recipient: string, payload: string): Promise<MailboxSendResult>
  sendPlain(recipient: string, payload: string): Promise<MailboxSendResult>
}

/** Ein Callback pro Queue-Eintrag — reine Drain-Logik im Core bleibt ohne `kind`-Verzweigung. */
export type OfflineMailboxTrySend = (item: OfflineMailboxQueueItem) => Promise<MailboxSendResult>

export function createOfflineMailboxTrySendFromSendPort(port: OfflineMailboxSendPort): OfflineMailboxTrySend {
  return (item) =>
    item.kind === 'encrypted_send'
      ? port.sendEncrypted(item.recipient, item.payload)
      : port.sendPlain(item.recipient, item.payload)
}

export type OfflineMailboxDrainOnceArg = OfflineMailboxSendPort | OfflineMailboxTrySend

export function coerceOfflineMailboxTrySend(arg: OfflineMailboxDrainOnceArg): OfflineMailboxTrySend {
  return typeof arg === 'function' ? arg : createOfflineMailboxTrySendFromSendPort(arg)
}
