import { describe, expect, it } from 'vitest'
import { sortInboxPinnwandFirst } from '@/frontend/lib/inbox-pinnwand-sort'
import type { Message } from '@/frontend/lib/types'

const BOARD = '0x' + 'a'.repeat(64)

function msg(id: string, recipient: string, ts: number): Message {
  return {
    id,
    from: '0x' + 'b'.repeat(64),
    recipient,
    content: id,
    timestamp: ts,
    encrypted: false,
  }
}

describe('sortInboxPinnwandFirst', () => {
  it('sortiert Lagebild oben', () => {
    const rows = [
      msg('d', '0x' + 'c'.repeat(64), 3000),
      msg('p', BOARD, 1000),
      msg('p2', BOARD, 2000),
    ]
    const out = sortInboxPinnwandFirst(rows, { broadcastAddress: BOARD })
    expect(out.map((m) => m.id)).toEqual(['p2', 'p', 'd'])
  })
})
