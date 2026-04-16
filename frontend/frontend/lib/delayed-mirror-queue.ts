'use client'

/**
 * Warteschlange für LoRa→IOTA „Delayed Mirror“ (/send), wenn der erste Versuch scheitert oder offline.
 * Persistiert in localStorage; Drain: Poll (12s), Browser `online`, Tab sichtbar, Backoff pro Eintrag.
 */

const STORAGE_KEY = 'morg.delayed-mirror-queue.v1'
const MAX_ITEMS = 80
/** Grober Schutz vor vollem localStorage (Klartext nach LoRa-Zusammenbau). */
const MAX_WIRE_BODY_CHARS = 1_200_000

export type MirrorQueueItem = {
  id: string
  wireBody: string
  fromAddress: string
  createdAt: number
  attempts: number
  lastAttemptAt: number
  lastError?: string
}

export function mirrorPayloadFromWireBody(wireBody: string): string {
  return `[[MORG_LORA_IOTA_MIRROR_V1]]\n${wireBody}`
}

function safeParse(raw: string | null): MirrorQueueItem[] {
  if (!raw) return []
  try {
    const a = JSON.parse(raw) as unknown
    if (!Array.isArray(a)) return []
    return a.filter(
      (x): x is MirrorQueueItem =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as MirrorQueueItem).id === 'string' &&
        typeof (x as MirrorQueueItem).wireBody === 'string' &&
        typeof (x as MirrorQueueItem).fromAddress === 'string'
    )
  } catch {
    return []
  }
}

export function loadMirrorQueue(): MirrorQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

export function saveMirrorQueue(items: MirrorQueueItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    /* quota */
  }
}

export function mirrorQueueDedupKey(fromAddress: string, wireBody: string): string {
  return `${fromAddress}:${wireBody.length}:${wireBody.slice(0, 200)}`
}

export function hasMirrorQueuePending(fromAddress: string, wireBody: string): boolean {
  const k = mirrorQueueDedupKey(fromAddress, wireBody)
  return loadMirrorQueue().some((q) => mirrorQueueDedupKey(q.fromAddress, q.wireBody) === k)
}

export function enqueueMirrorFailure(opts: {
  wireBody: string
  fromAddress: string
  lastError?: string
}): { ok: boolean; queued: boolean; reason?: string } {
  const { wireBody, fromAddress, lastError } = opts
  if (wireBody.length > MAX_WIRE_BODY_CHARS) {
    return { ok: false, queued: false, reason: 'Inhalt zu groß für lokale Warteschlange.' }
  }
  const k = mirrorQueueDedupKey(fromAddress, wireBody)
  const cur = loadMirrorQueue()
  if (cur.some((q) => mirrorQueueDedupKey(q.fromAddress, q.wireBody) === k)) {
    return { ok: true, queued: false }
  }
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `mq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const next: MirrorQueueItem = {
    id,
    wireBody,
    fromAddress,
    createdAt: Date.now(),
    attempts: 0,
    lastAttemptAt: 0,
    lastError,
  }
  cur.push(next)
  saveMirrorQueue(cur)
  return { ok: true, queued: true }
}

export function getMirrorQueueCount(): number {
  return loadMirrorQueue().length
}

/** Mindestabstand zwischen Versuchen (ms), steigt mit attempts. */
function backoffMs(attempts: number): number {
  return Math.min(180_000, 2000 * Math.pow(2, Math.min(attempts, 9)))
}

export type MirrorSendResult =
  | { ok: true; txDigest?: string }
  | { ok: false; error?: string }

export type MirrorSendFn = (fullPayload: string) => Promise<MirrorSendResult>

/**
 * Verarbeitet wartende Einträge nacheinander. Überspringt Einträge in Backoff.
 */
export async function drainMirrorQueue(
  send: MirrorSendFn,
  onSent?: (item: MirrorQueueItem) => void
): Promise<{
  sent: number
  failed: number
  remaining: number
}> {
  const items = loadMirrorQueue().sort((a, b) => a.createdAt - b.createdAt)
  if (items.length === 0) return { sent: 0, failed: 0, remaining: 0 }

  const now = Date.now()
  const kept: MirrorQueueItem[] = []
  let sent = 0
  let failed = 0

  for (const item of items) {
    const wait = backoffMs(item.attempts)
    if (item.attempts > 0 && now - item.lastAttemptAt < wait) {
      kept.push(item)
      continue
    }

    const payload = mirrorPayloadFromWireBody(item.wireBody)
    const r = await send(payload)
    if (r.ok) {
      sent++
      onSent?.(item)
    } else {
      failed++
      kept.push({
        ...item,
        attempts: item.attempts + 1,
        lastAttemptAt: Date.now(),
        lastError: 'error' in r ? r.error : undefined,
      })
    }
  }

  saveMirrorQueue(kept)
  return { sent, failed, remaining: kept.length }
}
