'use client'

import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import {
  groupMailboxTargetCount,
  readGroupMailboxSendAll,
} from '@/frontend/lib/group-mailbox-pairwise-send'
import { resolveGroupTeamMailboxObjectId } from '@/frontend/lib/group-team-broadcast'

export type GroupSendPanelContext = {
  groupMailboxSendAll: boolean
  groupMemberCount: number
  groupTeamBroadcastReady: boolean
  groupTeamMailboxObjectId: string | null
}

/** Send-Panel / Persistenz-Inferenz: gemeinsame Gruppen-Flags für Core und Main-Content. */
export function buildGroupSendPanelContext(p: {
  isGroupChannel: boolean
  activeGroup: MessengerGroupDefinition | null
  myAddress: string
}): GroupSendPanelContext {
  const isGroup = p.isGroupChannel && Boolean(p.activeGroup)
  const teamMb = isGroup ? resolveGroupTeamMailboxObjectId(p.activeGroup) : null
  return {
    groupMailboxSendAll: isGroup && readGroupMailboxSendAll(),
    groupMemberCount: isGroup ? groupMailboxTargetCount(p.activeGroup!, p.myAddress) : 0,
    groupTeamBroadcastReady: Boolean(teamMb),
    groupTeamMailboxObjectId: teamMb,
  }
}
