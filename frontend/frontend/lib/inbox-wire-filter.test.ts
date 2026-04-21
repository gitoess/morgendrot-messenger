import { describe, expect, it } from 'vitest'
import { messageMatchesInboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import type { Message } from '@/frontend/lib/types'

function m(p: Partial<Message>): Message {
  return {
    id: '1',
    from: '0x' + 'a'.repeat(64),
    content: 'x',
    timestamp: 1,
    ...p,
  }
}

describe('messageMatchesInboxWireFilter', () => {
  it('all passthrough', () => {
    expect(messageMatchesInboxWireFilter(m({ encrypted: true }), 'all')).toBe(true)
    expect(messageMatchesInboxWireFilter(m({ encrypted: false }), 'all')).toBe(true)
    expect(messageMatchesInboxWireFilter(m({}), 'all')).toBe(true)
  })
  it('encrypted only when true', () => {
    expect(messageMatchesInboxWireFilter(m({ encrypted: true }), 'encrypted')).toBe(true)
    expect(messageMatchesInboxWireFilter(m({ encrypted: false }), 'encrypted')).toBe(false)
    expect(messageMatchesInboxWireFilter(m({}), 'encrypted')).toBe(false)
  })
  it('plaintext when not strictly encrypted', () => {
    expect(messageMatchesInboxWireFilter(m({ encrypted: false }), 'plaintext')).toBe(true)
    expect(messageMatchesInboxWireFilter(m({}), 'plaintext')).toBe(true)
    expect(messageMatchesInboxWireFilter(m({ encrypted: true }), 'plaintext')).toBe(false)
  })
})
