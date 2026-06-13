'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  getActiveMessengerGroup,
  type MessengerGroupDefinition,
} from '@/frontend/lib/messenger-group-store'
import { resolveGroupTeamMailboxObjectId } from '@/frontend/lib/group-team-broadcast'

/** Aktive Gruppe + Refresh — aus use-chat-view-core extrahiert (P1). */
export function useChatViewMessengerGroup(isGroup: boolean) {
  const [groupsRevision, setGroupsRevision] = useState(0)
  const activeGroup: MessengerGroupDefinition | null = useMemo(() => {
    if (!isGroup) return null
    void groupsRevision
    return getActiveMessengerGroup()
  }, [isGroup, groupsRevision])
  const groupTeamMailboxId = useMemo(
    () => resolveGroupTeamMailboxObjectId(activeGroup),
    [activeGroup]
  )
  const refreshMessengerGroups = useCallback(() => setGroupsRevision((n) => n + 1), [])
  return { activeGroup, groupTeamMailboxId, refreshMessengerGroups }
}
