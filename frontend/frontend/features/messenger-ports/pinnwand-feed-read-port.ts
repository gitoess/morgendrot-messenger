import type { ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'
import type { Message } from '@/frontend/lib/types'

/** Pinnwand-Kanal-Feed (gefilterte Zeilen/Messages, P6). */
export type PinnwandFeedReadPort = {
  readonly feedMessages: readonly Message[]
  readonly feedInboxRows: readonly ChatInboxRow[]
}

export function asPinnwandFeedRead(
  feedMessages: readonly Message[],
  feedInboxRows: readonly ChatInboxRow[]
): PinnwandFeedReadPort {
  return { feedMessages, feedInboxRows }
}
