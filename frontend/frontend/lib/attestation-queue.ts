'use client'

import {
  ATTESTATION_QUEUE_STORAGE_KEY,
  drainAttestationQueueOnce,
  enqueueAttestationDraft,
  parseAttestationQueueJson,
  serializeAttestationQueueJson,
  type AttestationManifestDraftV1,
  type AttestationQueueItem,
  type AttestationSubmitResult,
} from '@morgendrot/core/attestation'
import { createCryptoUuidIdGenerator } from '@morgendrot/core'

const ids = createCryptoUuidIdGenerator()

export function loadAttestationQueue(): AttestationQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    return parseAttestationQueueJson(window.localStorage.getItem(ATTESTATION_QUEUE_STORAGE_KEY))
  } catch {
    return []
  }
}

export function saveAttestationQueue(items: AttestationQueueItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ATTESTATION_QUEUE_STORAGE_KEY, serializeAttestationQueueJson(items))
  } catch {
    /* ignore */
  }
}

export function enqueueAttestationManifestDraft(draft: AttestationManifestDraftV1): {
  ok: true
  remaining: number
} | { ok: false; reason: string } {
  const cur = loadAttestationQueue()
  const r = enqueueAttestationDraft({ items: cur, id: ids.randomId(), draft, now: Date.now() })
  if (!r.ok) return { ok: false, reason: r.reason }
  saveAttestationQueue(r.items)
  return { ok: true, remaining: r.items.length }
}

/** Standard-Submit: Platzhalter — echte IOTA-Verankerung folgt. */
export async function defaultAttestationSubmit(_draft: AttestationManifestDraftV1): Promise<AttestationSubmitResult> {
  return { ok: false, error: 'Attestation-IOTA-Upload noch nicht implementiert.' }
}

export async function drainAttestationQueue(
  submit = defaultAttestationSubmit
): Promise<{ sent: number; failed: number; remaining: number }> {
  const cur = loadAttestationQueue()
  if (cur.length === 0) return { sent: 0, failed: 0, remaining: 0 }
  const { items, sent, failed } = await drainAttestationQueueOnce({
    items: cur,
    nowMs: Date.now(),
    submit,
  })
  saveAttestationQueue(items)
  return { sent, failed, remaining: items.length }
}
