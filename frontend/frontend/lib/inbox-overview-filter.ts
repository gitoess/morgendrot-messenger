import { messageBelongsToPinnwand } from '@/frontend/lib/messenger-pinnwand-capabilities'
import {
  messageTouchesMeshTransport,
} from '@/frontend/features/inbox/inbox-partner-filter'
import type { Message } from '@/frontend/lib/types'

/** Vereinfachte Posteingangs-Kategorien (Helfer / Simple Mode). */
export type InboxOverviewCategory = 'alle' | 'lagebild' | 'direkt' | 'funk'

export type InboxOverviewFilterContext = {
  myAddress: string
  broadcastAddress: string
  /** Pinnwand oben im Streifen — aus Hauptliste ausblenden. */
  excludePinnwandFromAlle?: boolean
}

export function inboxMessageOverviewCategory(
  msg: Message,
  ctx: InboxOverviewFilterContext
): Exclude<InboxOverviewCategory, 'alle'> {
  const board = ctx.broadcastAddress.trim().toLowerCase()
  if (board && messageBelongsToPinnwand(msg, board)) return 'lagebild'
  if (messageTouchesMeshTransport(msg)) return 'funk'
  return 'direkt'
}

export function filterInboxByOverviewCategory(
  messages: Message[],
  category: InboxOverviewCategory,
  ctx: InboxOverviewFilterContext
): Message[] {
  if (category === 'alle') {
    if (!ctx.excludePinnwandFromAlle) return messages
    const board = ctx.broadcastAddress.trim().toLowerCase()
    if (!board) return messages
    return messages.filter((m) => !messageBelongsToPinnwand(m, board))
  }
  return messages.filter((m) => inboxMessageOverviewCategory(m, ctx) === category)
}

export function countInboxByOverviewCategory(
  messages: Message[],
  ctx: InboxOverviewFilterContext
): Record<InboxOverviewCategory, number> {
  const counts: Record<InboxOverviewCategory, number> = {
    alle: 0,
    lagebild: 0,
    direkt: 0,
    funk: 0,
  }
  for (const m of messages) {
    const cat = inboxMessageOverviewCategory(m, ctx)
    counts[cat] += 1
    if (ctx.excludePinnwandFromAlle && cat === 'lagebild') continue
    counts.alle += 1
  }
  return counts
}
