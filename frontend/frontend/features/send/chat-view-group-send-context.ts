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
}

/** Send-Panel / Persistenz-Inferenz: gemeinsame Gruppen-Flags für Core und Main-Content. */
export function buildGroupSendPanelContext(p: {
  isGroupChannel: boolean
  activeGroup: MessengerGroupDefinition | null
  myAddress: string
}): GroupSendPanelContext {
  const isGroup = p.isGroupChannel && Boolean(p.activeGroup)
  return {
    groupMailboxSendAll: isGroup && readGroupMailboxSendAll(),
    groupMemberCount: isGroup ? groupMailboxTargetCount(p.activeGroup!, p.myAddress) : 0,
    groupTeamBroadcastReady: isGroup && !!resolveGroupTeamMailboxObjectId(p.activeGroup),
  }
}
