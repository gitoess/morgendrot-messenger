/**
 * API-Rohzeilen → Message (gemeinsam für Posteingang-Hook und vollständigen Export).
 */

import { contentDedupKey } from '@/frontend/lib/message-dedup'
import type { Message } from '@/frontend/lib/types'
import { normalizeChatMessageContentForDisplay } from '@/frontend/lib/chat-message-display-normalize'
import { pickInboxRawMessages as pickInboxRawMessagesImpl } from '@/frontend/lib/inbox-pick-raw-messages'

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

/** Re-Export: Implementierung in `lib/inbox-pick-raw-messages.ts` (**§ H.1b** — reine Inbox-Helfer unter `lib/`). */
export const pickInboxRawMessages = pickInboxRawMessagesImpl

export function mapInboxApiRowsToMessages(raw: InboxApiRow[]): Message[] {
  const mapped: Message[] = raw.map((m, i) => {
    const from = m.sender ?? m.from ?? ''
    const rawT = m.text != null ? String(m.text) : ''
    const rawC = m.content != null ? String(m.content) : ''
    const contentRaw = (() => {
      if (!rawC) return rawT
      if (!rawT) return rawC
      const cM = rawC.includes('[[MORG_')
      const tM = rawT.includes('[[MORG_')
      if (cM !== tM) return cM ? rawC : rawT
      return rawC.length >= rawT.length ? rawC : rawT
    })()
    const content = normalizeChatMessageContentForDisplay(contentRaw)
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
