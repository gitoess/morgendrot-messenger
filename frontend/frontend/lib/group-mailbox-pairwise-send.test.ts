import { describe, it, expect, beforeEach } from 'vitest'
import {
  readGroupMailboxSendAll,
  resolveGroupMailboxSendTargets,
  writeGroupMailboxSendAll,
} from '@/frontend/lib/group-mailbox-pairwise-send'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

const ME = '0x' + 'aa'.repeat(32)
const M1 = '0x' + 'bb'.repeat(32)
const M2 = '0x' + 'cc'.repeat(32)

const GROUP: MessengerGroupDefinition = {
  id: 'g1',
  name: 'Trupp',
  memberAddresses: [ME, M1, M2],
}

describe('group-mailbox-pairwise-send', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear()
  })

  it('sendAll excludes self', () => {
    expect(
      resolveGroupMailboxSendTargets({
        activeGroup: GROUP,
        myAddress: ME,
        composerRecipient: '',
        sendAllMembers: true,
      })
    ).toEqual([M1, M2])
  })

  it('single mode uses composer recipient', () => {
    expect(
      resolveGroupMailboxSendTargets({
        activeGroup: GROUP,
        myAddress: ME,
        composerRecipient: M1,
        sendAllMembers: false,
      })
    ).toEqual([M1])
  })

  it('localStorage toggles sendAll default on', () => {
    expect(readGroupMailboxSendAll()).toBe(true)
    writeGroupMailboxSendAll(false)
    expect(readGroupMailboxSendAll()).toBe(true)
  })
})
