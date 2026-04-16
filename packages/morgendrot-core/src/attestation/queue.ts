/**
 * Lokale Attestation-Outbox (Manifest-Entwürfe) — **noch ohne** festes On-Chain-Format.
 * Submit über **`AttestationSubmitPort`** (Browser: z. B. **`browserAttestationSubmit`** im Frontend — Klartext-Hybrid; kein Core-Default).
 */

import { ATTESTATION_QUEUE_ITEM_STATUS, type AttestationManifestDraftV1 } from './model'

export const ATTESTATION_QUEUE_STORAGE_KEY = 'morgendrot.attestation-queue.v1'
export const ATTESTATION_QUEUE_MAX_ITEMS = 40

export type AttestationQueueItem = {
  id: string
  status: (typeof ATTESTATION_QUEUE_ITEM_STATUS)['pending'] | (typeof ATTESTATION_QUEUE_ITEM_STATUS)['failed']
  draft: AttestationManifestDraftV1
  createdAt: number
  attempts: number
  lastAttemptAt: number
  lastError?: string
  /** Nach erfolgreichem Submit (optional). */
  chainDigest?: string
}

export type AttestationSubmitResult =
  | { ok: true; chainDigest?: string }
  | { ok: false; error: string }

export type AttestationSubmitPort = {
  submit(draft: AttestationManifestDraftV1): Promise<AttestationSubmitResult>
}

function clampItems(items: AttestationQueueItem[]): AttestationQueueItem[] {
  if (items.length <= ATTESTATION_QUEUE_MAX_ITEMS) return items
  const sorted = [...items].sort((a, b) => a.createdAt - b.createdAt)
  return sorted.slice(-ATTESTATION_QUEUE_MAX_ITEMS)
}

export function parseAttestationQueueJson(raw: string | null | undefined): AttestationQueueItem[] {
  if (!raw?.trim()) return []
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return []
    const out: AttestationQueueItem[] = []
    for (const x of v) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id.trim() : ''
      const status = o.status === ATTESTATION_QUEUE_ITEM_STATUS.failed ? ATTESTATION_QUEUE_ITEM_STATUS.failed : ATTESTATION_QUEUE_ITEM_STATUS.pending
      const createdAt = typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) ? o.createdAt : 0
      const attempts = typeof o.attempts === 'number' && Number.isFinite(o.attempts) ? Math.max(0, o.attempts) : 0
      const lastAttemptAt =
        typeof o.lastAttemptAt === 'number' && Number.isFinite(o.lastAttemptAt) ? o.lastAttemptAt : 0
      const d = o.draft
      if (!d || typeof d !== 'object') continue
      const dr = d as Record<string, unknown>
      if (dr.manifestVersion !== 1) continue
      const optHex64 = (v: unknown): string | undefined => {
        if (typeof v !== 'string') return undefined
        const t = v.trim().toLowerCase()
        return /^[0-9a-f]{64}$/.test(t) ? t : undefined
      }
      const draft: AttestationManifestDraftV1 = {
        manifestVersion: 1,
        canonicalMsgRefHex: typeof dr.canonicalMsgRefHex === 'string' ? dr.canonicalMsgRefHex : null,
        observedAtMs: typeof dr.observedAtMs === 'number' && Number.isFinite(dr.observedAtMs) ? dr.observedAtMs : createdAt,
        timeIsTrusted: dr.timeIsTrusted === true,
      }
      const sec = optHex64(dr.secondaryCanonicalMsgRefHex)
      if (sec !== undefined) draft.secondaryCanonicalMsgRefHex = sec
      const imgH = optHex64(dr.imageContentSha256Hex)
      if (imgH !== undefined) draft.imageContentSha256Hex = imgH
      const mtxRaw = dr.mirrorMailboxTxDigest
      if (typeof mtxRaw === 'string') {
        const t = mtxRaw.trim()
        if (t.length > 0 && t.length <= 128 && /^[0-9a-zA-Z+/=_-]+$/.test(t)) draft.mirrorMailboxTxDigest = t
      }
      if (!id) continue
      out.push({
        id,
        status,
        draft,
        createdAt,
        attempts,
        lastAttemptAt,
        ...(typeof o.lastError === 'string' ? { lastError: o.lastError } : {}),
        ...(typeof o.chainDigest === 'string' ? { chainDigest: o.chainDigest } : {}),
      })
    }
    return out
  } catch {
    return []
  }
}

export function serializeAttestationQueueJson(items: AttestationQueueItem[]): string {
  return JSON.stringify(items)
}

export function enqueueAttestationDraft(params: {
  items: AttestationQueueItem[]
  id: string
  draft: AttestationManifestDraftV1
  now: number
}): { ok: true; items: AttestationQueueItem[] } | { ok: false; reason: string } {
  const next: AttestationQueueItem = {
    id: params.id,
    status: ATTESTATION_QUEUE_ITEM_STATUS.pending,
    draft: params.draft,
    createdAt: params.now,
    attempts: 0,
    lastAttemptAt: 0,
  }
  const merged = clampItems([...params.items, next])
  if (!merged.some((x) => x.id === params.id)) {
    return { ok: false, reason: 'Attestation-Warteschlange voll (älteste Einträge wurden verworfen).' }
  }
  return { ok: true, items: merged }
}

/** Ein Drain-Lauf: nacheinander pending/failed (mit Backoff) versuchen. */
export async function drainAttestationQueueOnce(params: {
  items: AttestationQueueItem[]
  nowMs: number
  submit: AttestationSubmitPort['submit']
}): Promise<{ items: AttestationQueueItem[]; sent: number; failed: number }> {
  const backoff = (n: number) => Math.min(120_000, 2000 * Math.pow(2, Math.min(n, 6)))
  let sent = 0
  let failed = 0
  const list = [...params.items].sort((a, b) => a.createdAt - b.createdAt)
  const next: AttestationQueueItem[] = []

  for (const item of list) {
    const defer =
      item.status === ATTESTATION_QUEUE_ITEM_STATUS.failed &&
      item.attempts > 0 &&
      params.nowMs - item.lastAttemptAt < backoff(item.attempts)
    if (item.status === ATTESTATION_QUEUE_ITEM_STATUS.pending || (item.status === ATTESTATION_QUEUE_ITEM_STATUS.failed && !defer)) {
      const r = await params.submit(item.draft)
      if (r.ok) {
        sent++
        continue
      }
      failed++
      next.push({
        ...item,
        status: ATTESTATION_QUEUE_ITEM_STATUS.failed,
        attempts: item.attempts + 1,
        lastAttemptAt: params.nowMs,
        lastError: r.error,
        ...(r.ok === false ? {} : {}),
      })
      continue
    }
    next.push(item)
  }

  return { items: clampItems(next), sent, failed }
}
