import { messageCounterpartyAddress } from '@/frontend/features/inbox/inbox-partner-filter'
import type { Message } from '@/frontend/lib/types'

/** Stumm-Schlüssel für eine Inbox-Zeile (Ton/Filter lokal). */
export function muteKeyForInboxMessage(
  msg: Pick<Message, 'from' | 'recipient' | 'pinnwandPost' | 'chainPurgeKind'>,
  myAddress: string
): string | null {
  if (msg.pinnwandPost) return 'pinnwand'
  if (msg.chainPurgeKind === 'team-broadcast') {
    const team = (msg.recipient ?? '').trim().toLowerCase()
    return team ? `team:${team}` : 'team'
  }
  const cp = messageCounterpartyAddress(msg as Message, myAddress)
  const k = (cp ?? '').trim().toLowerCase()
  return k || null
}

/** Stumm-Schlüssel für aktuelle Sidebar-/Header-Auswahl. */
export function muteKeyForConversation(opts: {
  inboxPartnerKey?: string | null
  inboxConversationGroupId?: string | null
  teamMailboxObjectId?: string | null
  isPinnwand?: boolean
}): string | null {
  if (opts.isPinnwand) return 'pinnwand'
  const teamMb = (opts.teamMailboxObjectId ?? '').trim().toLowerCase()
  if (teamMb) return `team:${teamMb}`
  const gid = (opts.inboxConversationGroupId ?? '').trim().toLowerCase()
  if (gid) return `group:${gid}`
  const peer = (opts.inboxPartnerKey ?? '').trim().toLowerCase()
  return peer || null
}
