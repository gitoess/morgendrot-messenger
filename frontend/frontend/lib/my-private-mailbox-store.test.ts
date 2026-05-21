import { describe, expect, it, beforeEach } from 'vitest'
import {
  ACTIVE_SERVER_MAILBOX,
  addMyPrivateMailbox,
  archiveMyPrivateMailbox,
  cacheServerMailboxObjectId,
  forgetMyPrivateMailbox,
  readActiveMailboxSelection,
  readArchivedMyPrivateMailboxes,
  readCachedServerMailboxObjectId,
  readMyPrivateMailboxes,
  restoreMyPrivateMailbox,
  setActiveServerMailbox,
} from '@/frontend/lib/my-private-mailbox-store'

const ID_A = '0x' + 'aa'.repeat(32)
const ID_B = '0x' + 'bb'.repeat(32)

describe('my-private-mailbox-store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to server mailbox active', () => {
    expect(readActiveMailboxSelection()).toEqual({ kind: 'server' })
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
    expect(readActiveMailboxSelection()).toEqual({ kind: 'server' })
    restoreMyPrivateMailbox(ID_A)
    expect(readMyPrivateMailboxes()).toHaveLength(1)
    expect(readArchivedMyPrivateMailboxes()).toHaveLength(0)
  })

  it('switches to server active', () => {
    addMyPrivateMailbox({ objectId: ID_A })
    setActiveServerMailbox()
    expect(readActiveMailboxSelection()).toEqual({ kind: 'server' })
    expect(localStorage.getItem('morgendrot.activePrivateMailboxObjectId.v2')).toBe(ACTIVE_SERVER_MAILBOX)
  })

  it('migrates legacy v1 single id', () => {
    localStorage.setItem('morgendrot.myPrivateMailboxObjectId.v1', ID_A)
    expect(readMyPrivateMailboxes()[0]?.objectId).toBe(ID_A)
    expect(readActiveMailboxSelection()).toEqual({ kind: 'private', objectId: ID_A })
  })

  it('forget removes from list and archive after rebate', () => {
    addMyPrivateMailbox({ objectId: ID_A })
    addMyPrivateMailbox({ objectId: ID_B })
    archiveMyPrivateMailbox(ID_B)
    forgetMyPrivateMailbox(ID_A)
    forgetMyPrivateMailbox(ID_B)
    expect(readMyPrivateMailboxes()).toHaveLength(0)
    expect(readArchivedMyPrivateMailboxes()).toHaveLength(0)
    expect(readActiveMailboxSelection()).toEqual({ kind: 'server' })
  })
})
