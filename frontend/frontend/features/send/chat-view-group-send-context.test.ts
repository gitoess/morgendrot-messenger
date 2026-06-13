import { describe, expect, it } from 'vitest'
import { buildGroupSendPanelContext } from '@/frontend/features/send/chat-view-group-send-context'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

const MB = '0x' + 'a'.repeat(64)

const group: MessengerGroupDefinition = {
  id: 'g1',
  name: 'Test',
  memberAddresses: ['0x' + 'b'.repeat(64)],
  teamMailboxObjectId: MB,
}

describe('chat-view-group-send-context', () => {
  it('liefert Gruppen-Flags für Send-Panel', () => {
    const ctx = buildGroupSendPanelContext({
      isGroupChannel: true,
      activeGroup: group,
      myAddress: '0x' + 'c'.repeat(64),
    })
    expect(ctx.groupMailboxSendAll).toBe(true)
    expect(ctx.groupMemberCount).toBe(1)
    expect(ctx.groupTeamBroadcastReady).toBe(true)
  })

  it('ist leer außerhalb Gruppenkanal', () => {
    const ctx = buildGroupSendPanelContext({
      isGroupChannel: false,
      activeGroup: group,
      myAddress: '0x' + 'c'.repeat(64),
    })
    expect(ctx.groupMailboxSendAll).toBe(false)
    expect(ctx.groupMemberCount).toBe(0)
    expect(ctx.groupTeamBroadcastReady).toBe(false)
  })
})
