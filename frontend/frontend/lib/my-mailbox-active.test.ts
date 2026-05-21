import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearActiveSendMailbox,
  readActiveSendMailbox,
  setActivePrivateMailboxObjectId,
  setActiveTeamMailboxObjectId,
} from './my-mailbox-active'

const ID = '0x' + 'aa'.repeat(32)
const TEAM = '0x' + 'bb'.repeat(32)

describe('my-mailbox-active', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to none', () => {
    expect(readActiveSendMailbox()).toEqual({ kind: 'none' })
  })

  it('switches team vs private', () => {
    setActiveTeamMailboxObjectId(TEAM)
    expect(readActiveSendMailbox()).toEqual({ kind: 'team', objectId: TEAM })
    setActivePrivateMailboxObjectId(ID)
    expect(readActiveSendMailbox()).toEqual({ kind: 'private', objectId: ID })
    clearActiveSendMailbox()
    expect(readActiveSendMailbox()).toEqual({ kind: 'none' })
  })
})
