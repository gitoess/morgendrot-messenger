import type { InboxUnreadThreadOption } from '@/frontend/components/chat-view-inbox-unread-threads-strip'
import type { ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'

/** Posteingangs-Panel: Zeilen, Zähler und Thread-Chips (readonly + Filter-Reset, P8). */
export type InboxPanelReadPort = {
  readonly inboxRows: readonly ChatInboxRow[]
  readonly inboxTotalCount: number
  readonly inboxUnreadThreadOptions: readonly InboxUnreadThreadOption[]
  readonly resetInboxViewFilters: () => void
}

export function asInboxPanelRead(read: InboxPanelReadPort): InboxPanelReadPort {
  return read
}
