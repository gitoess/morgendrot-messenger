/**
 * Device / custody attestation queue — **types only** (Scheibe 1).
 * Persistenz, Drain und IOTA-PTB folgen in einer späteren Scheibe (**Attestation-Queue**).
 *
 * @see docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md (Custody, Manifest)
 * @see docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md (Stufe 4 Relay optional)
 */

export const ATTESTATION_QUEUE_ITEM_STATUS = {
  pending: 'pending',
  uploading: 'uploading',
  anchored: 'anchored',
  failed: 'failed',
} as const

export type AttestationQueueItemStatus =
  (typeof ATTESTATION_QUEUE_ITEM_STATUS)[keyof typeof ATTESTATION_QUEUE_ITEM_STATUS]

/** Stable id for dedup before chain digest exists (v1 placeholder). */
export type AttestationQueueItemId = string

/**
 * Draft payload to be anchored (hash-only or expanded later).
 * Fields align loosely with delayed-upload manifest §4 — extend when wiring the queue.
 */
export type AttestationManifestDraftV1 = {
  manifestVersion: 1
  /** `canonical_msg_ref` v1 hex (64 chars), when known. */
  canonicalMsgRefHex: string | null
  observedAtMs: number
  timeIsTrusted: boolean
}
