import { describe, expect, it } from 'vitest'
import { messageMatchesInboxSourceFilter } from '@/frontend/lib/inbox-source-filter'
import type { Message } from '@/frontend/lib/types'

function m(partial: Partial<Message>): Message {
  return {
    id: 'x',
    from: '0xs',
    content: 'hi',
    timestamp: 1,
    ...partial,
  }
}

describe('messageMatchesInboxSourceFilter', () => {
  it('telegram vs mailbox', () => {
    const tg = m({ source: 'telegram', transports: ['telegram'] })
    const mb = m({ source: 'mailbox', transports: ['internet'], chainPurgeable: true })
    expect(messageMatchesInboxSourceFilter(tg, 'telegram')).toBe(true)
    expect(messageMatchesInboxSourceFilter(mb, 'telegram')).toBe(false)
    expect(messageMatchesInboxSourceFilter(mb, 'mailbox')).toBe(true)
  })

  it('gruppe per chainPurgeKind', () => {
    const row = m({
      chainPurgeKind: 'team-broadcast',
      recipient: '0xteam',
      transports: ['internet'],
    })
    expect(messageMatchesInboxSourceFilter(row, 'group')).toBe(true)
    expect(messageMatchesInboxSourceFilter(row, 'mailbox')).toBe(false)
  })
})
