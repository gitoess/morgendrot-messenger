import { describe, expect, it } from 'vitest'
import {
  messageLooksCipherProtected,
  messageMatchesInboxWireFilter,
} from '@/frontend/lib/inbox-wire-filter'
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
  it('encrypted: ECDH-Flag oder PWMSG/NFTGATE-Wire', () => {
    expect(messageMatchesInboxWireFilter(m({ encrypted: true }), 'encrypted')).toBe(true)
    expect(messageMatchesInboxWireFilter(m({ encrypted: false }), 'encrypted')).toBe(false)
    expect(messageMatchesInboxWireFilter(m({}), 'encrypted')).toBe(false)
    expect(
      messageMatchesInboxWireFilter(
        m({ encrypted: false, content: 'MORG_PWMSG_V1:abc' }),
        'encrypted'
      )
    ).toBe(true)
    expect(
      messageMatchesInboxWireFilter(
        m({ encrypted: false, content: 'MORG_NFTGATE_V1:abc' }),
        'encrypted'
      )
    ).toBe(true)
  })
  it('plaintext when not cipher-protected', () => {
    expect(messageMatchesInboxWireFilter(m({ encrypted: false }), 'plaintext')).toBe(true)
    expect(messageMatchesInboxWireFilter(m({}), 'plaintext')).toBe(true)
    expect(messageMatchesInboxWireFilter(m({ encrypted: true }), 'plaintext')).toBe(false)
    expect(
      messageMatchesInboxWireFilter(
        m({ encrypted: false, content: 'MORG_PWMSG_V1:abc' }),
        'plaintext'
      )
    ).toBe(false)
  })
  it('messageLooksCipherProtected', () => {
    expect(messageLooksCipherProtected(m({ encrypted: true }))).toBe(true)
    expect(messageLooksCipherProtected(m({ content: 'hallo' }))).toBe(false)
    expect(messageLooksCipherProtected(m({ content: 'MORG_PWMSG_V1:x' }))).toBe(true)
  })
})
