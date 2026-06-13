/**
 * API-Rohzeilen → Message (gemeinsam für Posteingang-Hook und vollständigen Export).
 */

import { contentDedupKey } from '@/frontend/lib/message-dedup'
import { resolveInboxRowDedupKey } from '@morgendrot/core/iota'

function isEncryptedPlaceholderContent(s: string): boolean {
  return s.trimStart().startsWith('[Verschlüsselt]')
}
import type { Message } from '@/frontend/lib/types'
import { normalizeChatMessageContentForDisplay } from '@/frontend/lib/chat-message-display-normalize'
import { hasPinnwandPostMarker } from '@/frontend/lib/pinnwand-post-marker'
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
  chainPurgeKind?: 'pairwise' | 'team-broadcast'
  /** Backend Dedup (evid:… / mb:…) — trennt gleiche nonce=1. */
  inboxKey?: string
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
    const pinnwandPost = hasPinnwandPostMarker(contentRaw)
    const content = normalizeChatMessageContentForDisplay(contentRaw)
    const nonceStr = m.nonce != null && String(m.nonce).length > 0 ? String(m.nonce) : ''
    const tsRaw = m.ts ?? m.timestamp
    let timestamp =
      typeof tsRaw === 'number' && !Number.isNaN(tsRaw)
        ? tsRaw
        : typeof tsRaw === 'string'
          ? Number(tsRaw)
          : 0
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      const nn = Number(nonceStr.replace(/\D/g, '')) || Number(nonceStr)
      /** Nur ms-artige Nonce (Offline-Queue) — kleine nonce=1 wäre sonst Jahr 1970 und sortiert falsch. */
      if (Number.isFinite(nn) && nn >= 1_000_000_000_000) timestamp = nn
      else timestamp = 0
    }
    const chainChannel = m.chainPurgeable === false ? 'event' : 'mailbox'
    const recipientNorm = (m.recipient ?? '').trim().toLowerCase()
    const inboxKey = typeof m.inboxKey === 'string' ? m.inboxKey.trim() : ''
    const stableId =
      m.id ??
      (inboxKey ||
        (nonceStr && from
          ? `${chainChannel}:${from.trim().toLowerCase()}:${nonceStr}:${timestamp}`
          : `${chainChannel}-row-${i}`))
    const dedupKey = resolveInboxRowDedupKey({
      sender: from,
      recipient: recipientNorm,
      nonce: nonceStr || undefined,
      timestamp,
      inboxKey: inboxKey || undefined,
      content,
      fallbackContentDedupKey: contentDedupKey(from, content, timestamp),
    })
    return {
      id: stableId,
      from,
      content,
      ...(pinnwandPost ? { pinnwandPost: true as const } : {}),
      timestamp,
      encrypted:
        m.isPlain === false ||
        (m.isPlain !== true && isEncryptedPlaceholderContent(content)),
      recipient: m.recipient,
      source: 'mailbox' as const,
      transports: ['internet'] as ('internet' | 'mesh' | 'adhoc')[],
      dedupKey,
      chainNonce: m.nonce != null && String(m.nonce).length > 0 ? String(m.nonce) : undefined,
      chainPurgeable: m.chainPurgeable === true,
      chainPurgeKind:
        m.chainPurgeKind === 'team-broadcast' || (inboxKey && inboxKey.startsWith('team:'))
          ? 'team-broadcast'
          : m.chainPurgeable === true
            ? 'pairwise'
            : undefined,
    }
  })
  mapped.sort((a, b) => b.timestamp - a.timestamp)
  return mapped
}
