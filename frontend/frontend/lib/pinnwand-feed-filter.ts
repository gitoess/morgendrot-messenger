import type { ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'
import type { Message } from '@/frontend/lib/types'

/** Pinnwand-Feed: nur Pinnwand-Nachrichten und Nicht-Message-Zeilen (Slides, Mesh-Banner). */
export function filterPinnwandFeedRows(
  rows: ChatInboxRow[],
  isPinnwand?: (msg: Message) => boolean
): ChatInboxRow[] {
  if (!isPinnwand) return rows
  return rows.filter((row) => row.kind !== 'msg' || isPinnwand(row.msg))
}
