import { describe, expect, it } from 'vitest'
import { messageMatchesInboxSearch, searchInboxMessages } from '@/frontend/lib/inbox-unified-search'
import type { Message } from '@/frontend/lib/types'

const my = '0x' + 'a'.repeat(64)
const partner = '0x' + 'b'.repeat(64)

describe('inbox-unified-search', () => {
  it('findet Nachrichten nach Inhalt und Kontakt-Alias', () => {
    const msg: Message = {
      id: '1',
      from: partner,
      content: 'Treffpunkt Alpha',
      timestamp: 100,
    }
    expect(messageMatchesInboxSearch(msg, 'alpha', my, {})).toBe(true)
    expect(
      messageMatchesInboxSearch(msg, 'boss', my, {
        [partner]: { label: 'Boss Max' },
      })
    ).toBe(true)
  })

  it('liefert Snippets sortiert nach Zeit', () => {
    const hits = searchInboxMessages(
      'hello',
      [
        { id: '1', from: partner, content: 'hello alt', timestamp: 1 },
        { id: '2', from: partner, content: 'hello neu', timestamp: 99 },
      ],
      my,
      {}
    )
    expect(hits.map((h) => h.messageId)).toEqual(['2', '1'])
  })
})
