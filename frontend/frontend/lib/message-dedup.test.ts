import { describe, it, expect } from 'vitest'
import {
  collapseNearDuplicateThreadRows,
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

  it('wählt Klartext statt längerem Wire', () => {
    const wire =
      'MORG_PWMSG_V1:TU9SR1BXTVNHMQCyeyJzY2hlbWEiOiJtb3JnZW5kcm90LnBhc3NwaHJhc2UubXNnLnYxIn0='
    expect(pickMergedInboxContent(wire, 'ok')).toBe('ok')
    expect(pickMergedInboxContent('ok', wire)).toBe('ok')
  })

  it('wählt Klartext/Hint statt RATCHET_V3-JSON (API+Direct-Merge)', () => {
    const wire =
      '{"morg":"RATCHET_V3","header":{"v":3,"cs":1,"dh":"x","pn":0,"n":0,"msgId":"1","ts":1},"bodyB64":"YWJj"}'
    expect(pickMergedInboxContent(wire, 'double ratchet')).toBe('double ratchet')
    expect(pickMergedInboxContent('double ratchet', wire)).toBe('double ratchet')
    expect(pickMergedInboxContent(wire, '[Double Ratchet] Opt-in aus')).toBe(
      '[Double Ratchet] Opt-in aus'
    )
  })

  it('wählt kurzen Klartext statt langem Double-Ratchet-Hint (API-Fail + Direct-OK)', () => {
    const hint =
      '[Double Ratchet] Innere Lage nicht lesbar — Flag beiderseits an, Experiment aus→an, dann neue Enc.'
    expect(pickMergedInboxContent(hint, 'und')).toBe('und')
    expect(pickMergedInboxContent('und', hint)).toBe('und')
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

describe('collapseNearDuplicateThreadRows', () => {
  it('lässt eine von zwei identischen Ausgangs-Zeilen (gleicher Text/Zeit)', () => {
    const me = '0x' + 'a'.repeat(64)
    const peer = '0x' + 'b'.repeat(64)
    const ts = 1_000_000
    const a = msg({
      id: 'optimistic:dm:1',
      from: me,
      recipient: peer,
      content: 'abba jetzt',
      timestamp: ts,
    })
    const b = msg({
      id: 'event:1',
      from: me,
      recipient: peer,
      content: 'abba jetzt',
      timestamp: ts,
      chainPurgeable: true,
      chainNonce: '99',
    })
    const r = collapseNearDuplicateThreadRows([a, b])
    expect(r).toHaveLength(1)
    expect(r[0]!.id).toBe('event:1')
  })
})
