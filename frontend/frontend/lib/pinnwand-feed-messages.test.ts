import { describe, expect, it } from 'vitest'
import { selectPinnwandFeedMessages } from '@/frontend/lib/pinnwand-feed-messages'
import type { Message } from '@/frontend/lib/types'

const BOARD = '0x' + 'a'.repeat(64)
const BOSS = '0x' + 'b'.repeat(64)

function msg(partial: Partial<Message> & { id: string }): Message {
  return {
    from: BOSS,
    recipient: BOARD,
    content: 'test',
    timestamp: 1,
    encrypted: false,
    ...partial,
  } as Message
}

describe('selectPinnwandFeedMessages', () => {
  const ctx = { broadcastAddress: BOARD, authorizedSenders: [BOSS] }

  it('liefert nur Lagebild-Posts', () => {
    const out = selectPinnwandFeedMessages(
      [msg({ id: '1' }), msg({ id: '2', recipient: BOSS })],
      ctx
    )
    expect(out.map((m) => m.id)).toEqual(['1'])
  })

  it('sortiert gepinnte zuerst', () => {
    const out = selectPinnwandFeedMessages(
      [
        msg({ id: 'old', timestamp: 100 }),
        msg({ id: 'new', timestamp: 200 }),
      ],
      ctx,
      new Set(['old'])
    )
    expect(out.map((m) => m.id)).toEqual(['old', 'new'])
  })

  it('leer ohne Brett-Kontext', () => {
    expect(selectPinnwandFeedMessages([msg({ id: '1' })], null)).toEqual([])
  })
})
