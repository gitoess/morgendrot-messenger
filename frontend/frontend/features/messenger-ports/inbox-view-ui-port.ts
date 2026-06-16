import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import type { InboxDirectionFilter } from '@/frontend/features/inbox/inbox-partner-filter'
import type { InboxOverviewCategory } from '@/frontend/lib/inbox-overview-filter'
import type { InboxSourceFilter } from '@/frontend/lib/inbox-source-filter'
import type { InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import type { Message } from '@/frontend/lib/types'

/** Posteingang: Filter, Auswahl, Übersicht-Chips (Panel-Hook P3). */
export type InboxViewUiPort = {
  readonly inboxPartnerOptions: readonly InboxPartnerOption[]
  readonly inboxPartnerKey: string | null
  readonly setInboxPartnerKey: (k: string | null) => void
  readonly inboxDirectionFilter: InboxDirectionFilter
  readonly setInboxDirectionFilter: (d: InboxDirectionFilter) => void
  readonly inboxSourceFilter: InboxSourceFilter
  readonly setInboxSourceFilter: (f: InboxSourceFilter) => void
  readonly inboxChannelFiltersArmed: boolean
  readonly setInboxChannelFiltersArmed: (v: boolean) => void
  readonly inboxWireFiltersArmed: boolean
  readonly setInboxWireFiltersArmed: (v: boolean) => void
  readonly inboxPartnerFiltersArmed: boolean
  readonly setInboxPartnerFiltersArmed: (v: boolean) => void
  readonly inboxWireFilter: InboxWireFilter
  readonly setInboxWireFilter: (f: InboxWireFilter) => void
  readonly selectInboxPartnerForSend: (address: string) => void
  readonly selectInboxConversationAll: () => void
  readonly selectInboxConversationPartner: (address: string) => void
  readonly selectInboxConversationGroup: (groupId: string) => void
  readonly inboxConversationGroupId: string | null
  readonly removeInboxPartnerFromQuickList: (
    address: string,
    opts?: { hideMatchingMessages?: boolean; messageTransport?: 'mesh' | 'iota' | 'all' }
  ) => void
  readonly inboxVisibilityHint: string | null | undefined
  readonly inboxOverviewChipsVisible: boolean
  readonly inboxOverviewCategory: InboxOverviewCategory
  readonly setInboxOverviewCategory: (c: InboxOverviewCategory) => void
  readonly inboxOverviewUnreadCounts: Record<InboxOverviewCategory, number>
  readonly isInboxMessageUnread: (msg: Message) => boolean
  readonly isPinnwandInboxMessage: (msg: Message) => boolean
  readonly inboxSelectMode: boolean
  readonly setInboxSelectMode: (v: boolean | ((p: boolean) => boolean)) => void
  readonly selectedInboxIds: Set<string>
  readonly hiddenInboxCount: number
  readonly toggleInboxSelection: (id: string) => void
  readonly selectAllVisibleInbox: () => void
  readonly clearInboxSelection: () => void
  readonly protokollMarkedIds: Set<string>
  readonly toggleProtokollMark: (id: string) => void
  readonly pinnedPinnwandIds: Set<string>
  readonly togglePinnedPinnwand: (id: string) => void
}

export function asInboxViewUi(port: InboxViewUiPort): InboxViewUiPort {
  return port
}
