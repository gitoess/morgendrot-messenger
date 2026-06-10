import { describe, expect, it } from 'vitest'
import {
  countUnreadInboxByOverviewCategory,
  isIncomingInboxMessage,
  markInboxOverviewCategorySeenFromMessages,
  messageReceivedAtMs,
  readInboxOverviewLastSeen,
  writeInboxOverviewCategoryLastSeen,
} from '@/frontend/lib/inbox-overview-unread'
import type { Message } from '@/frontend/lib/types'

const BOARD = '0x' + 'a'.repeat(64)
const ME = '0x' + 'c'.repeat(64)
const BOSS = '0x' + 'b'.repeat(64)

function msg(partial: Partial<Message> & { id: string }): Message {
  return {
    from: BOSS,
    recipient: BOSS,
    content: 'hi',
    timestamp: 1000,
    ...partial,
  } as Message
}

describe('inbox-overview-unread', () => {
  const ctx = { myAddress: ME, broadcastAddress: BOARD, excludePinnwandFromAlle: true }

  it('ignoriert eigene Nachrichten', () => {
    expect(isIncomingInboxMessage(msg({ id: '1', from: ME }), ME)).toBe(false)
    expect(isIncomingInboxMessage(msg({ id: '2', from: BOSS }), ME)).toBe(true)
  })

  it('zählt ungelesen pro Kategorie', () => {
    const messages = [
      msg({ id: '1', recipient: BOARD, timestamp: 2000 }),
      msg({ id: '2', timestamp: 3000 }),
      msg({ id: '3', from: ME, timestamp: 4000 }),
    ]
    const lastSeen = { alle: 1500, lagebild: 1500, direkt: 2500, funk: 0 }
    const unread = countUnreadInboxByOverviewCategory(messages, ctx, lastSeen)
    expect(unread.lagebild).toBe(1)
    expect(unread.direkt).toBe(1)
    expect(unread.alle).toBe(1)
  })

  it('markiert Kategorie als gelesen bis max timestamp', () => {
    const scope = 'test-scope-unread'
    writeInboxOverviewCategoryLastSeen(scope, 'alle', 0)
    const messages = [msg({ id: '1', timestamp: 5000 }), msg({ id: '2', timestamp: 9000 })]
    markInboxOverviewCategorySeenFromMessages(scope, 'alle', messages, {
      myAddress: ME,
      broadcastAddress: BOARD,
    })
    const seen = readInboxOverviewLastSeen(scope)
    expect(seen.alle).toBeGreaterThanOrEqual(9000)
    expect(messageReceivedAtMs(msg({ id: 'x', timestamp: 0 }))).toBe(0)
  })
})
