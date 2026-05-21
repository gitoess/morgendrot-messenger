import { describe, expect, it, beforeEach } from 'vitest'
import {
  ACTIVE_SERVER_MAILBOX,
  addMyPrivateMailbox,
  archiveMyPrivateMailbox,
  cacheServerMailboxObjectId,
  forgetMyPrivateMailbox,
  readActiveMailboxSelection,
  readActivePrivateMailboxObjectId,
  readArchivedMyPrivateMailboxes,
  readCachedServerMailboxObjectId,
  readMyPrivateMailboxes,
  restoreMyPrivateMailbox,
  setActiveServerMailbox,
} from '@/frontend/lib/my-private-mailbox-store'
import { readActiveSendMailbox } from '@/frontend/lib/my-mailbox-active'

const ID_A = '0x' + 'aa'.repeat(32)
const ID_B = '0x' + 'bb'.repeat(32)

describe('my-private-mailbox-store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to no private active (shared send only)', () => {
    expect(readActiveMailboxSelection()).toEqual({ kind: 'none' })
    expect(readActivePrivateMailboxObjectId()).toBe('')
  })

  it('caches server mailbox id from status', () => {
    const SERVER = '0x' + 'cc'.repeat(32)
    cacheServerMailboxObjectId(SERVER)
    expect(readCachedServerMailboxObjectId()).toBe(SERVER)
    cacheServerMailboxObjectId('invalid')
    expect(readCachedServerMailboxObjectId()).toBe('')
  })

  it('archives and restores private mailbox', () => {
    addMyPrivateMailbox({ objectId: ID_A })
    archiveMyPrivateMailbox(ID_A)
    expect(readMyPrivateMailboxes()).toHaveLength(0)
    expect(readArchivedMyPrivateMailboxes()).toHaveLength(1)
    expect(readActiveMailboxSelection()).toEqual({ kind: 'none' })
    restoreMyPrivateMailbox(ID_A)
    expect(readMyPrivateMailboxes()).toHaveLength(1)
    expect(readArchivedMyPrivateMailboxes()).toHaveLength(0)
  })

  it('clears active private (shared send only)', () => {
    addMyPrivateMailbox({ objectId: ID_A })
    setActiveServerMailbox()
    expect(readActiveMailboxSelection()).toEqual({ kind: 'none' })
    expect(readActivePrivateMailboxObjectId()).toBe('')
    expect(localStorage.getItem('morgendrot.activeSendMailbox.v3')).toBe(ACTIVE_SERVER_MAILBOX)
  })

  it('migrates legacy v1 single id', () => {
    localStorage.setItem('morgendrot.myPrivateMailboxObjectId.v1', ID_A)
    expect(readMyPrivateMailboxes()[0]?.objectId).toBe(ID_A)
    expect(readActiveSendMailbox()).toEqual({ kind: 'private', objectId: ID_A })
  })

  it('forget removes from list and archive after rebate', () => {
    addMyPrivateMailbox({ objectId: ID_A })
    addMyPrivateMailbox({ objectId: ID_B })
    archiveMyPrivateMailbox(ID_B)
    forgetMyPrivateMailbox(ID_A)
    forgetMyPrivateMailbox(ID_B)
    expect(readMyPrivateMailboxes()).toHaveLength(0)
    expect(readArchivedMyPrivateMailboxes()).toHaveLength(0)
    expect(readActiveMailboxSelection()).toEqual({ kind: 'none' })
  })
})
