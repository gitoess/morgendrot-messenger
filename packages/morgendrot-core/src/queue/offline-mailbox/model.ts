/**
 * § H.3g Paket 7 — Client-Mailbox-Outbox (Domänenmodell, transportneutral).
 * Persistenz und Netz liegen außerhalb (@morgendrot/core).
 */

export const OFFLINE_MAILBOX_QUEUE_STORAGE_KEY = 'morgendrot.offline-mailbox-queue.v1'

export const OFFLINE_MAILBOX_MAX_ITEMS = 60

export const OFFLINE_MAILBOX_MAX_PAYLOAD_CHARS = 512_000

/** Priorisierung für Drain: kleiner = früher. */
export const OFFLINE_MAILBOX_PRIORITY_DEFAULT = 100

/** Persistiert; `syncing` / `sent` sind für UI/Drain reserviert. */
export const OFFLINE_QUEUE_ITEM_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SENT: 'sent',
} as const

export type OfflineQueueItemStatus =
  (typeof OFFLINE_QUEUE_ITEM_STATUS)[keyof typeof OFFLINE_QUEUE_ITEM_STATUS]

export type OfflineMailboxKind = 'encrypted_send' | 'plain_send'

export type OfflineMailboxQueueItem = {
  id: string
  kind: OfflineMailboxKind
  status: OfflineQueueItemStatus
  recipient: string
  /** Verschlüsselt: JSON-Wire (v1) oder Legacy-Klartext für `/send-plain`-Drain. */
  payload: string
  encrypted: boolean
  /**
   * `true` nur bei DeviceTimeTrustLevel „high“ beim Enqueue.
   * Legacy-Einträge ohne Feld → in Codec `false`.
   */
  timeIsTrusted: boolean
  /** Monoton steigend pro Gerät (1…). */
  clientOutSeq: number
  createdAt: number
  attempts: number
  lastAttemptAt: number
  /** Drain-Priorität (kleiner = früher), Legacy/ohne Angabe: `OFFLINE_MAILBOX_PRIORITY_DEFAULT`. */
  priority: number
  lastError?: string
  /**
   * § H.12 — `canonical_msg_ref` (64 Hex, Kleinbuchstaben), vgl. `computeCanonicalMsgRefV1`.
   * Fehlt bei Legacy-Einträgen; Dedup nutzt dann weiter `offlineMailboxDedupKey`.
   */
  canonicalMsgRef?: string
}
