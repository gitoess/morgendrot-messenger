import { describe, expect, it } from 'vitest'
import {
  GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG,
  groupUsesTeamBroadcast,
  isGroupMailboxInternetChainSend,
  resolveGroupTeamMailboxObjectId,
  shouldSendGroupTeamBroadcast,
} from '@/frontend/lib/group-team-broadcast'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

const MB = '0x' + 'a'.repeat(64)

const group: MessengerGroupDefinition = {
  id: 'g1',
  name: 'Test',
  memberAddresses: ['0x' + 'b'.repeat(64)],
  teamMailboxObjectId: MB,
}

describe('group-team-broadcast', () => {
  it('resolveGroupTeamMailboxObjectId normalisiert', () => {
    expect(resolveGroupTeamMailboxObjectId(group)).toBe(MB.toLowerCase())
  })

  it('shouldSendGroupTeamBroadcast mailbox + internet + sendAll (Klartext)', () => {
    expect(
      shouldSendGroupTeamBroadcast({
        activeGroup: group,
        encrypted: false,
        messagingPersistenceMode: 'mailbox',
        forcedTransport: 'internet',
        sendAllMembers: true,
        isGroupChannel: true,
      })
    ).toBe(true)
  })

  it('shouldSendGroupTeamBroadcast auch bei Schloss (verschlüsselt)', () => {
    expect(
      shouldSendGroupTeamBroadcast({
        activeGroup: group,
        encrypted: true,
        messagingPersistenceMode: 'mailbox',
        forcedTransport: 'internet',
        sendAllMembers: true,
        isGroupChannel: true,
      })
    ).toBe(true)
  })

  it('useTeamBroadcast kann abgeschaltet werden', () => {
    expect(groupUsesTeamBroadcast({ ...group, useTeamBroadcast: false })).toBe(false)
  })

  it('isGroupMailboxInternetChainSend', () => {
    expect(
      isGroupMailboxInternetChainSend({
        isGroupChannel: true,
        messagingPersistenceMode: 'mailbox',
        forcedTransport: 'internet',
      })
    ).toBe(true)
    expect(
      isGroupMailboxInternetChainSend({
        isGroupChannel: true,
        messagingPersistenceMode: 'mailbox',
        forcedTransport: 'mesh',
      })
    ).toBe(false)
  })

  it('shouldSendGroupTeamBroadcast braucht teamMailboxObjectId', () => {
    const noMb = { ...group, teamMailboxObjectId: undefined }
    expect(
      shouldSendGroupTeamBroadcast({
        activeGroup: noMb,
        encrypted: false,
        messagingPersistenceMode: 'mailbox',
        forcedTransport: 'internet',
        sendAllMembers: true,
        isGroupChannel: true,
      })
    ).toBe(false)
  })

  it('encrypted pending message ist gesetzt', () => {
    expect(GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG).toContain('Team-Key')
  })
})
