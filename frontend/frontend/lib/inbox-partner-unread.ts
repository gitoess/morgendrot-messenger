import { messageCounterpartyAddress } from '@/frontend/features/inbox/inbox-partner-filter'
import { messageBelongsToPinnwand } from '@/frontend/lib/messenger-pinnwand-capabilities'
import {
  inboxScopeKey,
  isIncomingInboxMessage,
  messageReceivedAtMs,
} from '@/frontend/lib/inbox-overview-unread'
import type { Message } from '@/frontend/lib/types'

const LS_KEY = 'morgendrot.inbox.partnerLastSeen.v1'

export { inboxScopeKey }

type StoredPartnerLastSeen = {
  scope?: string
  byPartner?: Record<string, number>
}

function normPartner(address: string): string {
  return address.trim().toLowerCase()
}

export function readPartnerLastSeenMap(scopeKey: string): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredPartnerLastSeen
    if (parsed.scope !== scopeKey || !parsed.byPartner) return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed.byPartner)) {
      const n = Number(v)
      if (k && Number.isFinite(n) && n > 0) out[k] = n
    }
    return out
  } catch {
    return {}
  }
}

export function writePartnerLastSeen(scopeKey: string, partnerNorm: string, seenAtMs: number): Record<string, number> {
  const key = normPartner(partnerNorm)
  if (!key) return readPartnerLastSeenMap(scopeKey)
  const next = readPartnerLastSeenMap(scopeKey)
  next[key] = Math.max(next[key] ?? 0, seenAtMs)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        LS_KEY,
        JSON.stringify({ scope: scopeKey, byPartner: next } satisfies StoredPartnerLastSeen)
      )
    } catch {
      /* ignore */
    }
  }
  return next
}

export function messageCountsForPartnerThread(
  msg: Message,
  myAddress: string,
  partnerNorm: string,
  broadcastAddress?: string
): boolean {
  if (!isIncomingInboxMessage(msg, myAddress)) return false
  const board = (broadcastAddress ?? '').trim().toLowerCase()
  if (board && messageBelongsToPinnwand(msg, board)) return false
  const cp = messageCounterpartyAddress(msg, myAddress)
  return !!cp && normPartner(cp) === partnerNorm
}

export function countUnreadForPartner(
  messages: Message[],
  myAddress: string,
  partnerAddress: string,
  lastSeenMs: number,
  broadcastAddress?: string
): number {
  const partnerNorm = normPartner(partnerAddress)
  if (!partnerNorm) return 0
  let count = 0
  for (const m of messages) {
    if (!messageCountsForPartnerThread(m, myAddress, partnerNorm, broadcastAddress)) continue
    const ts = messageReceivedAtMs(m)
    if (ts > lastSeenMs) count += 1
  }
  return count
}

export function countUnreadByPartner(
  messages: Message[],
  myAddress: string,
  lastSeenMap: Record<string, number>,
  broadcastAddress?: string
): Record<string, number> {
  const out: Record<string, number> = {}
  const partnerNorms = new Set<string>()
  for (const m of messages) {
    const board = (broadcastAddress ?? '').trim().toLowerCase()
    if (board && messageBelongsToPinnwand(m, board)) continue
    const cp = messageCounterpartyAddress(m, myAddress)
    if (!cp) continue
    partnerNorms.add(normPartner(cp))
  }
  for (const partnerNorm of partnerNorms) {
    const unread = countUnreadForPartner(
      messages,
      myAddress,
      partnerNorm,
      lastSeenMap[partnerNorm] ?? 0,
      broadcastAddress
    )
    if (unread > 0) out[partnerNorm] = unread
  }
  return out
}

export function markPartnerSeenFromMessages(
  scopeKey: string,
  partnerAddress: string,
  messages: Message[],
  myAddress: string,
  broadcastAddress?: string
): Record<string, number> {
  const partnerNorm = normPartner(partnerAddress)
  if (!partnerNorm) return readPartnerLastSeenMap(scopeKey)
  let seenAt = Date.now()
  for (const m of messages) {
    if (!messageCountsForPartnerThread(m, myAddress, partnerNorm, broadcastAddress)) continue
    seenAt = Math.max(seenAt, messageReceivedAtMs(m))
  }
  return writePartnerLastSeen(scopeKey, partnerNorm, seenAt)
}

export function isInboxMessageUnreadForPartner(
  msg: Message,
  myAddress: string,
  lastSeenMap: Record<string, number>,
  broadcastAddress?: string
): boolean {
  if (!isIncomingInboxMessage(msg, myAddress)) return false
  const board = (broadcastAddress ?? '').trim().toLowerCase()
  if (board && messageBelongsToPinnwand(msg, board)) return false
  const cp = messageCounterpartyAddress(msg, myAddress)
  if (!cp) return false
  const ts = messageReceivedAtMs(msg)
  if (ts <= 0) return false
  return ts > (lastSeenMap[normPartner(cp)] ?? 0)
}
