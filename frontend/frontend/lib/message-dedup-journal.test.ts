import { describe, it, expect } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import { mergeJournalIntoInboxIfChanged } from './message-dedup'

function m(id: string, ts: number): Message {
  return {
    id,
    from: '0x1',
    content: 'x',
    timestamp: ts,
    encrypted: false,
    source: 'telegram',
    transports: ['telegram'],
  }
}

describe('mergeJournalIntoInboxIfChanged', () => {
  it('gibt prev zurück wenn Journal bereits enthalten', () => {
    const prev = [m('tg-1', 100)]
    const incoming = [m('tg-1', 100)]
    expect(mergeJournalIntoInboxIfChanged(prev, incoming)).toBe(prev)
  })

  it('merged neue Journal-Zeilen', () => {
    const prev = [m('tg-1', 100)]
    const incoming = [m('tg-2', 200)]
    const next = mergeJournalIntoInboxIfChanged(prev, incoming)
    expect(next).not.toBe(prev)
    expect(next.map((x) => x.id).sort()).toEqual(['tg-1', 'tg-2'])
  })
})
