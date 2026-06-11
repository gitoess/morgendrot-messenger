import { sortInboxPinnwandFirst } from '@/frontend/lib/inbox-pinnwand-sort'
import {
  messageBelongsToPinnwand,
  type PinnwandMatchContext,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
import type { Message } from '@/frontend/lib/types'

/** Nur Lagebild-Posts — gepinnte zuerst, dann neueste. */
export function selectPinnwandFeedMessages(
  messages: Message[],
  ctx: PinnwandMatchContext | null | undefined,
  pinnedPinnwandIds?: Set<string>
): Message[] {
  const board = ctx?.broadcastAddress.trim().toLowerCase()
  if (!board || !ctx) return []
  const only = messages.filter((m) => messageBelongsToPinnwand(m, ctx))
  if (only.length === 0) return []
  return sortInboxPinnwandFirst(
    only,
    ctx,
    pinnedPinnwandIds?.size ? pinnedPinnwandIds : undefined
  )
}
