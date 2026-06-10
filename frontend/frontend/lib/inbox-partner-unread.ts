import { messageCounterpartyAddress } from '@/frontend/features/inbox/inbox-partner-filter'
import {
  messageBelongsToPinnwand,
  type PinnwandMatchContext,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
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

function normalizePinnwandMatch(
  input?: string | PinnwandMatchContext | null
): PinnwandMatchContext | null {
  if (!input) return null
  if (typeof input === 'string') {
    const broadcastAddress = input.trim()
    return broadcastAddress ? { broadcastAddress } : null
  }
  return input.broadcastAddress?.trim() ? input : null
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
  pinnwandMatch?: string | PinnwandMatchContext | null
): boolean {
  if (!isIncomingInboxMessage(msg, myAddress)) return false
  const match = normalizePinnwandMatch(pinnwandMatch)
  if (match && messageBelongsToPinnwand(msg, match)) return false
  const cp = messageCounterpartyAddress(msg, myAddress)
  return !!cp && normPartner(cp) === partnerNorm
}

export function countUnreadForPartner(
  messages: Message[],
  myAddress: string,
  partnerAddress: string,
  lastSeenMs: number,
  pinnwandMatch?: string | PinnwandMatchContext | null
): number {
  const partnerNorm = normPartner(partnerAddress)
  if (!partnerNorm) return 0
  let count = 0
  for (const m of messages) {
    if (!messageCountsForPartnerThread(m, myAddress, partnerNorm, pinnwandMatch)) continue
    const ts = messageReceivedAtMs(m)
    if (ts > lastSeenMs) count += 1
  }
  return count
}

export function countUnreadByPartner(
  messages: Message[],
  myAddress: string,
  lastSeenMap: Record<string, number>,
  pinnwandMatch?: string | PinnwandMatchContext | null
): Record<string, number> {
  const out: Record<string, number> = {}
  const match = normalizePinnwandMatch(pinnwandMatch)
  const partnerNorms = new Set<string>()
  for (const m of messages) {
    if (match && messageBelongsToPinnwand(m, match)) continue
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
      match
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
  pinnwandMatch?: string | PinnwandMatchContext | null
): Record<string, number> {
  const partnerNorm = normPartner(partnerAddress)
  if (!partnerNorm) return readPartnerLastSeenMap(scopeKey)
  let seenAt = Date.now()
  for (const m of messages) {
    if (!messageCountsForPartnerThread(m, myAddress, partnerNorm, pinnwandMatch)) continue
    seenAt = Math.max(seenAt, messageReceivedAtMs(m))
  }
  return writePartnerLastSeen(scopeKey, partnerNorm, seenAt)
}

export function isInboxMessageUnreadForPartner(
  msg: Message,
  myAddress: string,
  lastSeenMap: Record<string, number>,
  pinnwandMatch?: string | PinnwandMatchContext | null
): boolean {
  if (!isIncomingInboxMessage(msg, myAddress)) return false
  const match = normalizePinnwandMatch(pinnwandMatch)
  if (match && messageBelongsToPinnwand(msg, match)) return false
  const cp = messageCounterpartyAddress(msg, myAddress)
  if (!cp) return false
  const ts = messageReceivedAtMs(msg)
  if (ts <= 0) return false
  return ts > (lastSeenMap[normPartner(cp)] ?? 0)
}
