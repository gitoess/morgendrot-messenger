import { describe, expect, it } from 'vitest'
import {
  countUnreadByPartner,
  countUnreadForPartner,
  isInboxMessageUnreadForPartner,
  markPartnerSeenFromMessages,
  readPartnerLastSeenMap,
} from '@/frontend/lib/inbox-partner-unread'
import type { Message } from '@/frontend/lib/types'

const ME = '0x' + 'c'.repeat(64)
const BOSS = '0x' + 'b'.repeat(64)
const BOARD = '0x' + 'a'.repeat(64)

function msg(partial: Partial<Message> & { id: string }): Message {
  return {
    from: BOSS,
    recipient: ME,
    content: 'hi',
    timestamp: 2000,
    ...partial,
  } as Message
}

describe('inbox-partner-unread', () => {
  const scope = 'partner-unread-test'

  it('zählt ungelesen pro Partner', () => {
    const messages = [
      msg({ id: '1', timestamp: 2000 }),
      msg({ id: '2', from: ME, recipient: BOSS, timestamp: 3000 }),
      msg({ id: '3', recipient: BOARD, timestamp: 4000 }),
    ]
    expect(countUnreadForPartner(messages, ME, BOSS, 1500, BOARD)).toBe(1)
    const byPartner = countUnreadByPartner(messages, ME, { [BOSS]: 1500 }, BOARD)
    expect(byPartner[BOSS]).toBe(1)
  })

  it('markiert Partner-Thread als gelesen', () => {
    const messages = [msg({ id: '1', timestamp: 8000 })]
    markPartnerSeenFromMessages(scope, BOSS, messages, ME, BOARD)
    const seen = readPartnerLastSeenMap(scope)
    expect(seen[BOSS]).toBeGreaterThanOrEqual(8000)
    expect(isInboxMessageUnreadForPartner(messages[0]!, ME, seen, BOARD)).toBe(false)
  })
})
