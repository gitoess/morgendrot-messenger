import {
  filterInboxByOverviewCategory,
  inboxMessageOverviewCategory,
  type InboxOverviewCategory,
  type InboxOverviewFilterContext,
} from '@/frontend/lib/inbox-overview-filter'
import type { Message } from '@/frontend/lib/types'

const LS_KEY = 'morgendrot.inbox.overviewLastSeen.v1'

export type InboxOverviewLastSeenMap = Record<InboxOverviewCategory, number>

const EMPTY_LAST_SEEN: InboxOverviewLastSeenMap = {
  alle: 0,
  lagebild: 0,
  direkt: 0,
  funk: 0,
}

type StoredOverviewLastSeen = {
  scope?: string
  byCategory?: Partial<Record<InboxOverviewCategory, number>>
}

export function inboxScopeKey(myAddress: string): string {
  const me = myAddress.trim().toLowerCase()
  return me || 'anon'
}

export function messageReceivedAtMs(msg: Message): number {
  const t = Number(msg.timestamp)
  return Number.isFinite(t) && t > 0 ? t : 0
}

/** Eingehende Nachrichten zählen für Ungelesen (eigene Sends ignorieren). */
export function isIncomingInboxMessage(msg: Message, myAddress: string): boolean {
  const me = myAddress.trim().toLowerCase()
  if (!me) return true
  const from = (msg.from ?? '').trim().toLowerCase()
  return from !== me
}

export function readInboxOverviewLastSeen(scopeKey: string): InboxOverviewLastSeenMap {
  if (typeof window === 'undefined') return { ...EMPTY_LAST_SEEN }
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return { ...EMPTY_LAST_SEEN }
    const parsed = JSON.parse(raw) as StoredOverviewLastSeen
    if (parsed.scope !== scopeKey || !parsed.byCategory) return { ...EMPTY_LAST_SEEN }
    return {
      alle: Number(parsed.byCategory.alle ?? 0) || 0,
      lagebild: Number(parsed.byCategory.lagebild ?? 0) || 0,
      direkt: Number(parsed.byCategory.direkt ?? 0) || 0,
      funk: Number(parsed.byCategory.funk ?? 0) || 0,
    }
  } catch {
    return { ...EMPTY_LAST_SEEN }
  }
}

export function writeInboxOverviewCategoryLastSeen(
  scopeKey: string,
  category: InboxOverviewCategory,
  seenAtMs: number
): InboxOverviewLastSeenMap {
  const next = readInboxOverviewLastSeen(scopeKey)
  next[category] = Math.max(next[category], seenAtMs)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        LS_KEY,
        JSON.stringify({ scope: scopeKey, byCategory: next } satisfies StoredOverviewLastSeen)
      )
    } catch {
      /* ignore */
    }
  }
  return next
}

/** Beim Öffnen einer Kategorie: bis zum neuesten sichtbaren Post als gelesen markieren. */
export function markInboxOverviewCategorySeenFromMessages(
  scopeKey: string,
  category: InboxOverviewCategory,
  messages: Message[],
  ctx: InboxOverviewFilterContext
): InboxOverviewLastSeenMap {
  const inCategory = filterInboxByOverviewCategory(messages, category, ctx)
  let seenAt = Date.now()
  for (const m of inCategory) {
    seenAt = Math.max(seenAt, messageReceivedAtMs(m))
  }
  return writeInboxOverviewCategoryLastSeen(scopeKey, category, seenAt)
}

export function countUnreadInboxByOverviewCategory(
  messages: Message[],
  ctx: InboxOverviewFilterContext,
  lastSeen: InboxOverviewLastSeenMap
): Record<InboxOverviewCategory, number> {
  const counts: Record<InboxOverviewCategory, number> = {
    alle: 0,
    lagebild: 0,
    direkt: 0,
    funk: 0,
  }
  for (const m of messages) {
    if (!isIncomingInboxMessage(m, ctx.myAddress)) continue
    const ts = messageReceivedAtMs(m)
    if (ts <= 0) continue
    const cat = inboxMessageOverviewCategory(m, ctx)
    if (ts > lastSeen[cat]) counts[cat] += 1
    if (ctx.excludePinnwandFromAlle && cat === 'lagebild') continue
    if (ts > lastSeen.alle) counts.alle += 1
  }
  return counts
}
