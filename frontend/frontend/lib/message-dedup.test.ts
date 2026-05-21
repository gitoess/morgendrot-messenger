import { describe, it, expect } from 'vitest'
import {
  contentDedupKey,
  mergeMessageByDedup,
  mergeAllMessages,
  pickMergedInboxContent,
  inboxMessageListSignature,
} from './message-dedup'
import type { Message } from './types'

function msg(p: Partial<Message> & Pick<Message, 'id' | 'timestamp'>): Message {
  return {
    id: p.id,
    timestamp: p.timestamp,
    content: p.content ?? '',
    from: p.from ?? '0x' + 'a'.repeat(64),
    dedupKey: p.dedupKey,
    transports: p.transports,
    encrypted: p.encrypted,
  }
}

describe('contentDedupKey', () => {
  it('gleicher Bucket bei gleichem Zeitfenster', () => {
    const w = 120_000
    const k1 = contentDedupKey('0xAb', 'hi', 1000, w)
    const k2 = contentDedupKey('0xab', 'hi', 1001, w)
    expect(k1).toBe(k2)
  })
})

describe('mergeMessageByDedup', () => {
  it('ohne dedupKey wird vorangestellt', () => {
    const a = msg({ id: '1', timestamp: 1 })
    const b = msg({ id: '2', timestamp: 2 })
    const r = mergeMessageByDedup([a], b)
    expect(r[0]!.id).toBe('2')
    expect(r[1]!.id).toBe('1')
  })

  it('ohne dedupKey: gleiche id wird nicht doppelt eingefügt (Mesh-RX)', () => {
    const id = 'mesh-txt-1-42-1000'
    const a = msg({ id, timestamp: 1000, content: 'Hallo' })
    const b = msg({ id, timestamp: 1000, content: 'Hallo' })
    const r = mergeMessageByDedup([a], b)
    expect(r).toHaveLength(1)
    expect(r[0]!.id).toBe(id)
  })

  it('merged transports und längeren content', () => {
    const cur = msg({
      id: 'x',
      timestamp: 10,
      dedupKey: 'k',
      content: 'kurz',
      transports: ['internet'],
    })
    const neu = msg({
      id: 'y',
      timestamp: 20,
      dedupKey: 'k',
      content: 'längerer text',
      transports: ['mesh'],
    })
    const r = mergeMessageByDedup([cur], neu)
    expect(r).toHaveLength(1)
    expect(r[0]!.content).toBe('längerer text')
    expect(r[0]!.transports?.sort()).toEqual(['internet', 'mesh'].sort())
    expect(r[0]!.id).toBe('x')
  })
})

describe('pickMergedInboxContent', () => {
  it('wählt echten Text statt Platzhalter', () => {
    expect(
      pickMergedInboxContent('[Verschlüsselt] x', 'Hallo')
    ).toBe('Hallo')
  })
})

describe('inboxMessageListSignature', () => {
  it('ändert sich bei Entschlüsselung (gleiche id/timestamp)', () => {
    const base = msg({ id: 'mailbox:0xab:1', timestamp: 100, encrypted: true, content: '[Verschlüsselt] x' })
    const decrypted = msg({ ...base, content: 'Hallo Welt', encrypted: true })
    expect(inboxMessageListSignature([base])).not.toBe(inboxMessageListSignature([decrypted]))
  })
})

describe('mergeAllMessages', () => {
  it('sortiert nach timestamp absteigend', () => {
    const r = mergeAllMessages([
      msg({ id: 'a', timestamp: 1, dedupKey: '1' }),
      msg({ id: 'b', timestamp: 3, dedupKey: '2' }),
      msg({ id: 'c', timestamp: 2, dedupKey: '3' }),
    ])
    expect(r.map((m) => m.id)).toEqual(['b', 'c', 'a'])
  })
})
