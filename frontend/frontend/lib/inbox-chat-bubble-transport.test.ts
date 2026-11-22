import { describe, expect, it } from 'vitest'
import { inboxChatBubbleTransportClass } from '@/frontend/lib/inbox-chat-bubble-transport'
import type { Message } from '@/frontend/lib/types'

function msg(over: Partial<Message>): Message {
  return {
    id: '1',
    from: '0x' + 'a'.repeat(64),
    content: 'hi',
    timestamp: Date.now(),
    encrypted: false,
    ...over,
  }
}

describe('inboxChatBubbleTransportClass', () => {
  it('Funk = mesh path class', () => {
    const c = inboxChatBubbleTransportClass(msg({ source: 'mesh', transports: ['mesh'] }), false)
    expect(c).toContain('chat-bubble-path--mesh')
    expect(c).toContain('chat-bubble-path--in')
  })

  it('IOTA/Mailbox = iota path class', () => {
    const c = inboxChatBubbleTransportClass(msg({ source: 'mailbox', transports: ['internet'] }), true)
    expect(c).toContain('chat-bubble-path--iota')
    expect(c).toContain('chat-bubble-path--out')
  })

  it('Telegram = telegram path (orange --path-telegram)', () => {
    const c = inboxChatBubbleTransportClass(msg({ source: 'telegram', transports: ['telegram'] }), false)
    expect(c).toContain('chat-bubble-path--telegram')
  })
})
