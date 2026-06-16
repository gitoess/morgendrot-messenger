import { describe, expect, it } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import {
  buildContactConversationMatch,
  isExcludedFromDirectContactThread,
  messageMatchesContactConversation,
  messagesForContactConversation,
} from '@/frontend/lib/contact-conversation-filter'

const me = '0x' + '1'.repeat(64)
const alice = '0x' + '2'.repeat(64)

function m(p: Partial<Message> & Pick<Message, 'id' | 'from' | 'content' | 'timestamp'>): Message {
  return { encrypted: false, ...p }
}

describe('contact-conversation-filter', () => {
  it('matcht IOTA-Gegenüber', () => {
    const match = buildContactConversationMatch(alice, { label: 'Alice' })
    const msg = m({ id: '1', from: alice, recipient: me, content: 'hi', timestamp: 1 })
    expect(messageMatchesContactConversation(msg, me, match)).toBe(true)
  })

  it('matcht Telegram-Chat-ID aus Telefonbuch', () => {
    const match = buildContactConversationMatch(alice, {
      label: 'Alice',
      telegramChatId: '99317902',
    })
    const msg = m({
      id: 'tg',
      from: me,
      recipient: 'tg:99317902',
      content: 'ping',
      timestamp: 2,
      source: 'telegram',
      transports: ['telegram'],
    })
    expect(messageMatchesContactConversation(msg, me, match)).toBe(true)
  })

  it('schließt Team-Broadcast aus', () => {
    expect(
      isExcludedFromDirectContactThread(
        m({ id: 't', from: alice, content: 'x', timestamp: 1, dedupKey: 'team:mb:1' })
      )
    ).toBe(true)
  })

  it('filtert Verlauf auf Kontakt', () => {
    const other = m({ id: 'o', from: '0x' + '3'.repeat(64), recipient: me, content: 'nope', timestamp: 3 })
    const mine = m({ id: 'a', from: alice, recipient: me, content: 'yes', timestamp: 4 })
    const rows = messagesForContactConversation([other, mine], me, alice, { label: 'Alice' })
    expect(rows.map((x) => x.id)).toEqual(['a'])
  })
})
