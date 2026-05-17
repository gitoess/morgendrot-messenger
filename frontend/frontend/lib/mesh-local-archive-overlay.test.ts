import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import { pickLocalOverlayRowsForInboxMerge } from './mesh-local-archive'

function msg(p: Partial<Message> & Pick<Message, 'id'>): Message {
  return {
    from: '0x1',
    content: 'x',
    timestamp: 1,
    encrypted: false,
    ...p,
  }
}

describe('pickLocalOverlayRowsForInboxMerge', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
      },
    })
  })

  it('behält Telegram-Zeilen aus prev beim Reset-Merge', () => {
    const tg = msg({
      id: 'tg-1',
      source: 'telegram',
      transports: ['telegram'],
      from: 'tg:99',
      recipient: '0xme',
    })
    const mailbox = msg({ id: 'mb-1', source: 'mailbox', from: '0x2' })
    const merged = pickLocalOverlayRowsForInboxMerge([tg, mailbox])
    expect(merged.map((m) => m.id).sort()).toEqual(['tg-1'])
  })

  it('behält Mesh-Zeilen aus prev', () => {
    const mesh = msg({ id: 'mx-1', transports: ['mesh'], source: 'mesh' })
    const merged = pickLocalOverlayRowsForInboxMerge([mesh])
    expect(merged.map((m) => m.id)).toEqual(['mx-1'])
  })
})
