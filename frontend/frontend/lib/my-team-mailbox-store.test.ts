import { describe, expect, it, beforeEach } from 'vitest'
import { readActiveSendMailbox } from './my-mailbox-active'
import {
  archiveMyTeamMailbox,
  joinMyTeamMailbox,
  readMyTeamMailboxes,
  restoreMyTeamMailbox,
} from './my-team-mailbox-store'

const ID = '0x' + 'cc'.repeat(32)

describe('my-team-mailbox-store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('join activates team mailbox', () => {
    joinMyTeamMailbox(ID, 'THW')
    expect(readMyTeamMailboxes()).toHaveLength(1)
    expect(readActiveSendMailbox()).toEqual({ kind: 'team', objectId: ID })
  })

  it('archive clears active team', () => {
    joinMyTeamMailbox(ID)
    archiveMyTeamMailbox(ID)
    expect(readMyTeamMailboxes()).toHaveLength(0)
    expect(readActiveSendMailbox()).toEqual({ kind: 'none' })
    restoreMyTeamMailbox(ID)
    expect(readActiveSendMailbox().kind).toBe('team')
  })
})
