import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { messageCounterpartyAddress } from '@/frontend/features/inbox/inbox-partner-filter'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { extractForwardablePlainText } from '@/frontend/lib/chat-forward-text'
import type { Message } from '@/frontend/lib/types'

export type InboxSearchMessageHit = {
  messageId: string
  snippet: string
  counterpartyAddress: string | null
  counterpartyLabel: string
  timestamp: number
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function searchableMessageText(msg: Message): string {
  const { text, isMediaHint } = extractForwardablePlainText(msg.content)
  const parts = [text]
  if (isMediaHint) parts.push('medien bild audio sprache datei')
  parts.push(msg.from ?? '', msg.recipient ?? '')
  if (msg.chainTxDigest) parts.push(msg.chainTxDigest)
  if (msg.dedupKey) parts.push(msg.dedupKey)
  return parts.join(' ').toLowerCase()
}

export function messageMatchesInboxSearch(
  msg: Message,
  query: string,
  myAddress: string,
  directory: Record<string, ContactMeshEntryClient>
): boolean {
  const q = norm(query)
  if (!q) return true
  if (searchableMessageText(msg).includes(q)) return true
  const cp = messageCounterpartyAddress(msg, myAddress)
  if (cp) {
    const label = contactDisplayLabel(directory, cp)
    if (label && norm(label).includes(q)) return true
    if (norm(cp).includes(q)) return true
  }
  return false
}

function snippetAroundMatch(text: string, query: string, maxLen = 96): string {
  const lower = text.toLowerCase()
  const q = query.trim().toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) {
    const compact = text.replace(/\s+/g, ' ').trim()
    return compact.length <= maxLen ? compact : `${compact.slice(0, maxLen - 1)}…`
  }
  const start = Math.max(0, idx - 24)
  const end = Math.min(text.length, idx + q.length + 48)
  const slice = text.slice(start, end).replace(/\s+/g, ' ').trim()
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${slice}${suffix}`
}

export function searchInboxMessages(
  query: string,
  messages: readonly Message[],
  myAddress: string,
  directory: Record<string, ContactMeshEntryClient>,
  maxResults = 24
): InboxSearchMessageHit[] {
  const q = query.trim()
  if (!q) return []
  const hits: InboxSearchMessageHit[] = []
  const sorted = [...messages].sort((a, b) => b.timestamp - a.timestamp)
  for (const msg of sorted) {
    if (!messageMatchesInboxSearch(msg, q, myAddress, directory)) continue
    const cp = messageCounterpartyAddress(msg, myAddress)
    const { text } = extractForwardablePlainText(msg.content)
    hits.push({
      messageId: msg.id,
      snippet: snippetAroundMatch(text, q),
      counterpartyAddress: cp,
      counterpartyLabel: cp ? contactDisplayLabel(directory, cp) || cp.slice(0, 12) + '…' : 'Unbekannt',
      timestamp: msg.timestamp,
    })
    if (hits.length >= maxResults) break
  }
  return hits
}
