import {
  messageBelongsToPinnwand,
  type PinnwandMatchContext,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
import { sortMessagesPinnedFirst } from '@/frontend/lib/pinnwand-pin-store'
import type { Message } from '@/frontend/lib/types'

/** Lagebild immer oben — ein Posteingang in allen Kanal-Modi. */
export function sortInboxPinnwandFirst(
  messages: Message[],
  pinnwandMatch: PinnwandMatchContext | null | undefined,
  pinnedPinnwandIds?: Set<string>
): Message[] {
  const board = pinnwandMatch?.broadcastAddress.trim().toLowerCase()
  if (!board) {
    return [...messages].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  }
  const pinnwand: Message[] = []
  const rest: Message[] = []
  for (const m of messages) {
    if (messageBelongsToPinnwand(m, pinnwandMatch!)) pinnwand.push(m)
    else rest.push(m)
  }
  pinnwand.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  rest.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  const pinned = pinnedPinnwandIds?.size
    ? sortMessagesPinnedFirst(pinnwand, pinnedPinnwandIds)
    : pinnwand
  return [...pinned, ...rest]
}
