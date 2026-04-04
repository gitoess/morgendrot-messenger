/**
 * API-Rohzeilen → Message (gemeinsam für Posteingang-Hook und vollständigen Export).
 */

import { contentDedupKey } from '@/frontend/lib/message-dedup'
import type { Message } from '@/frontend/lib/types'

export type InboxApiRow = {
  sender?: string
  from?: string
  text?: string
  content?: string
  isPlain?: boolean
  id?: string
  timestamp?: number
  recipient?: string
  nonce?: string
  ts?: number | string
  chainPurgeable?: boolean
}

/** API liefert oft `data` und `messages` identisch; niemals leeres `data` gegen volles `messages` tauschen. */
export function pickInboxRawMessages(res: { data?: unknown; messages?: unknown }): unknown[] | undefined {
  const d = res.data
  const m = res.messages
  const arrD = Array.isArray(d) ? d : null
  const arrM = Array.isArray(m) ? m : null
  if (arrD && arrD.length > 0) return arrD
  if (arrM && arrM.length > 0) return arrM
  if (arrD) return arrD
  if (arrM) return arrM
  return undefined
}

export function mapInboxApiRowsToMessages(raw: InboxApiRow[]): Message[] {
  const mapped: Message[] = raw.map((m, i) => {
    const from = m.sender ?? m.from ?? ''
    const rawT = m.text != null ? String(m.text) : ''
    const rawC = m.content != null ? String(m.content) : ''
    const content = (() => {
      if (!rawC) return rawT
      if (!rawT) return rawC
      const cM = rawC.includes('[[MORG_')
      const tM = rawT.includes('[[MORG_')
      if (cM !== tM) return cM ? rawC : rawT
      return rawC.length >= rawT.length ? rawC : rawT
    })()
    const tsRaw = m.ts ?? m.timestamp
    let timestamp =
      typeof tsRaw === 'number' && !Number.isNaN(tsRaw)
        ? tsRaw
        : typeof tsRaw === 'string'
          ? Number(tsRaw)
          : 0
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      const nn = Number(String(m.nonce ?? '').replace(/\D/g, '')) || Number(m.nonce)
      if (Number.isFinite(nn) && nn > 1_000_000_000_000) timestamp = nn
      else timestamp = 1e15 - i
    }
    return {
      id: m.id ?? `${from}-${m.nonce ?? i}`,
      from,
      content,
      timestamp,
      encrypted: m.isPlain === false,
      recipient: m.recipient,
      source: 'mailbox' as const,
      transports: ['internet'] as ('internet' | 'mesh' | 'adhoc')[],
      dedupKey: contentDedupKey(from, content, timestamp),
      chainNonce: m.nonce != null && String(m.nonce).length > 0 ? String(m.nonce) : undefined,
      chainPurgeable: m.chainPurgeable === true,
    }
  })
  mapped.sort((a, b) => b.timestamp - a.timestamp)
  return mapped
}
