import {
  messageBelongsToPinnwand,
  type PinnwandMatchContext,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
import {
  messageTouchesMeshTransport,
} from '@/frontend/features/inbox/inbox-partner-filter'
import type { Message } from '@/frontend/lib/types'

/** Vereinfachte Posteingangs-Kategorien (Helfer / Simple Mode). */
export type InboxOverviewCategory = 'alle' | 'lagebild' | 'direkt' | 'funk'

export type InboxOverviewFilterContext = {
  myAddress: string
  broadcastAddress: string
  /** Whitelist + Brett=eigenes Postfach — präzise Lagebild-Erkennung. */
  pinnwandMatch?: PinnwandMatchContext | null
  /** Pinnwand oben im Streifen — aus Hauptliste ausblenden. */
  excludePinnwandFromAlle?: boolean
}

function pinnwandMatchForOverview(ctx: InboxOverviewFilterContext): PinnwandMatchContext {
  return (
    ctx.pinnwandMatch ?? {
      broadcastAddress: ctx.broadcastAddress,
      myAddress: ctx.myAddress,
    }
  )
}

export function inboxMessageOverviewCategory(
  msg: Message,
  ctx: InboxOverviewFilterContext
): Exclude<InboxOverviewCategory, 'alle'> {
  const match = pinnwandMatchForOverview(ctx)
  if (match.broadcastAddress.trim() && messageBelongsToPinnwand(msg, match)) return 'lagebild'
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
    const match = pinnwandMatchForOverview(ctx)
    if (!match.broadcastAddress.trim()) return messages
    return messages.filter((m) => !messageBelongsToPinnwand(m, match))
  }
  return messages.filter((m) => inboxMessageOverviewCategory(m, ctx) === category)
}

/** Posteingangsliste nach Kategorie-Chips (Helfer/Simple) oder unverändert. */
export function resolveOverviewFilteredInboxMessages(
  sorted: Message[],
  opts: {
    overviewEnabled: boolean
    category: InboxOverviewCategory
    ctx: InboxOverviewFilterContext
  }
): Message[] {
  if (!opts.overviewEnabled) return sorted
  return filterInboxByOverviewCategory(sorted, opts.category, opts.ctx)
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
