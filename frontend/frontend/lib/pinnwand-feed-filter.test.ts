import { describe, expect, it } from 'vitest'
import { filterPinnwandFeedRows } from './pinnwand-feed-filter'
import type { ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'
import type { Message } from '@/frontend/lib/types'

const msg = (id: string): Message => ({ id, content: 'x', from: '0x', timestamp: 1 })

describe('filterPinnwandFeedRows (§ H.1b)', () => {
  const rows: ChatInboxRow[] = [
    { kind: 'slide', key: 's1', frames: ['a'], sortTs: 1 },
    { kind: 'msg', msg: msg('m1'), sortTs: 2 },
    { kind: 'msg', msg: msg('m2'), sortTs: 3 },
    { kind: 'meshInbound', id: 'mesh1', hint: 'h', error: null, sortTs: 4 },
  ]

  it('gibt alle Zeilen zurück ohne isPinnwand', () => {
    expect(filterPinnwandFeedRows(rows)).toEqual(rows)
  })

  it('filtert Nicht-Pinnwand-Nachrichten', () => {
    const isPinnwand = (m: Message) => m.id === 'm2'
    expect(filterPinnwandFeedRows(rows, isPinnwand)).toEqual([
      rows[0],
      rows[2],
      rows[3],
    ])
  })

  it('behält Slides und meshInbound unabhängig vom Filter', () => {
    const isPinnwand = () => false
    expect(filterPinnwandFeedRows(rows, isPinnwand)).toEqual([rows[0], rows[3]])
  })
})
