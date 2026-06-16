import type { InboxOverviewCategory, InboxOverviewFilterContext } from '@/frontend/lib/inbox-overview-filter'
import { resolveOverviewFilteredInboxMessages } from '@/frontend/lib/inbox-overview-filter'
import type { Message } from '@/frontend/lib/types'

/** Posteingangsliste: bei aktivem 1:1-Thread nur Partner-Filter, keine Overview-Kategorie. */
export function resolveActiveInboxDisplayMessages(
  sorted: readonly Message[],
  opts: {
    overviewEnabled: boolean
    category: InboxOverviewCategory
    ctx: InboxOverviewFilterContext
    inboxPartnerFiltersArmed: boolean
    inboxPartnerKey: string | null
    inboxConversationGroupId: string | null
  }
): Message[] {
  const activeDirectThread =
    opts.inboxPartnerFiltersArmed &&
    opts.inboxPartnerKey?.trim() &&
    !opts.inboxConversationGroupId
  if (activeDirectThread) {
    return [...sorted]
  }
  return resolveOverviewFilteredInboxMessages([...sorted], {
    overviewEnabled: opts.overviewEnabled,
    category: opts.category,
    ctx: opts.ctx,
  })
}
