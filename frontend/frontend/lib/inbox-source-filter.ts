import {
  isTeamBroadcastInboxRow,
  messageTouchesMeshTransport,
  messageTouchesTelegramTransport,
  messagePureInternetInboxRow,
} from '@/frontend/features/inbox/inbox-partner-filter'
import {
  messageBelongsToPinnwand,
  type PinnwandMatchContext,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
import type { Message } from '@/frontend/lib/types'

/** Quelle im Posteingang — nur aktiv wenn Kanal-Filter eingeschaltet. */
export type InboxSourceFilter = 'all' | 'mailbox' | 'group' | 'telegram' | 'funk' | 'lagebild'

export function isGroupBroadcastInboxRow(msg: Message): boolean {
  if (msg.chainPurgeKind === 'team-broadcast') return true
  const dk = msg.dedupKey?.trim() ?? ''
  return dk.startsWith('team:')
}

export function messageMatchesInboxSourceFilter(
  msg: Message,
  filter: InboxSourceFilter,
  ctx?: { pinnwandMatch?: PinnwandMatchContext | null; teamMailboxObjectId?: string | null }
): boolean {
  if (filter === 'all') return true
  if (filter === 'telegram') return messageTouchesTelegramTransport(msg)
  if (filter === 'funk') return messageTouchesMeshTransport(msg)
  if (filter === 'lagebild') {
    const match = ctx?.pinnwandMatch
    return Boolean(match?.broadcastAddress.trim() && messageBelongsToPinnwand(msg, match))
  }
  if (filter === 'group') {
    const teamMb = ctx?.teamMailboxObjectId?.trim() ?? ''
    if (teamMb && isTeamBroadcastInboxRow(msg, teamMb)) return true
    return isGroupBroadcastInboxRow(msg)
  }
  if (filter === 'mailbox') {
    if (messageTouchesTelegramTransport(msg)) return false
    if (messageTouchesMeshTransport(msg)) return false
    if (isGroupBroadcastInboxRow(msg)) return false
    const match = ctx?.pinnwandMatch
    if (match?.broadcastAddress.trim() && messageBelongsToPinnwand(msg, match)) return false
    return messagePureInternetInboxRow(msg)
  }
  return true
}

export function inboxSourceFilterLabel(filter: InboxSourceFilter): string {
  switch (filter) {
    case 'all':
      return 'All sources'
    case 'mailbox':
      return 'Mailbox'
    case 'group':
      return 'Group'
    case 'telegram':
      return 'Telegram'
    case 'funk':
      return 'Radio'
    case 'lagebild':
      return 'Pinnwand'
  }
}
