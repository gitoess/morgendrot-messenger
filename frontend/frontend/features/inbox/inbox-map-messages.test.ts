import { describe, it, expect } from 'vitest'
import { mergeAllMessages } from '@/frontend/lib/message-dedup'
import { mapInboxApiRowsToMessages, type InboxApiRow } from './inbox-map-messages'

describe('mapInboxApiRowsToMessages', () => {
  it('mappt sender, Inhalt und Mailbox-Felder', () => {
    const rows: InboxApiRow[] = [
      {
        sender: '0xs',
        text: 'hi',
        id: 'm1',
        timestamp: 1_700_000_000_000,
        recipient: '0xr',
        nonce: 'n1',
        chainPurgeable: true,
        isPlain: false,
      },
    ]
    const out = mapInboxApiRowsToMessages(rows)
    expect(out).toHaveLength(1)
    const m = out[0]!
    expect(m.id).toBe('m1')
    expect(m.from).toBe('0xs')
    expect(m.content).toBe('hi')
    expect(m.timestamp).toBe(1_700_000_000_000)
    expect(m.recipient).toBe('0xr')
    expect(m.encrypted).toBe(true)
    expect(m.source).toBe('mailbox')
    expect(m.transports).toEqual(['internet'])
    expect(m.chainNonce).toBe('n1')
    expect(m.chainPurgeable).toBe(true)
    expect(m.dedupKey).toBe('chain-msg|0xs|0xr|n1')
  })

  it('dedupliziert Stored-Mailbox + Event mit gleicher ms-Nonce', () => {
    const nonce = '1781371408086'
    const out = mergeAllMessages(
      mapInboxApiRowsToMessages([
        {
          sender: '0xs',
          text: 'mainnet',
          nonce,
          ts: 1781371408086,
          chainPurgeable: true,
          isPlain: true,
          inboxKey: 'mbp:0xs:0xr:1781371408086:1781371408086',
        },
        {
          sender: '0xs',
          text: 'mainnet',
          nonce,
          ts: 1781371408086,
          chainPurgeable: false,
          isPlain: true,
          inboxKey: 'evid:tx-event-1',
        },
      ])
    )
    expect(out).toHaveLength(1)
  })

  it('dedupliziert Event- und Mailbox-Zeile mit gleicher Nonce/Zeit', () => {
    const out = mergeAllMessages(
      mapInboxApiRowsToMessages([
        { sender: '0xs', text: 'ev', nonce: '42', chainPurgeable: false, isPlain: true },
        { sender: '0xs', text: 'mb', nonce: '42', chainPurgeable: true, isPlain: true },
      ])
    )
    expect(out).toHaveLength(1)
  })

  it('behält zwei verschlüsselte Events mit nonce=1 und unterschiedlichem inboxKey', () => {
    const out = mergeAllMessages(
      mapInboxApiRowsToMessages([
        {
          sender: '0xs',
          text: 'a',
          nonce: '1',
          isPlain: false,
          chainPurgeable: false,
          inboxKey: 'evid:aaa',
        },
        {
          sender: '0xs',
          text: 'b',
          nonce: '1',
          isPlain: false,
          chainPurgeable: false,
          inboxKey: 'evid:bbb',
        },
      ])
    )
    expect(out).toHaveLength(2)
  })

  it('trennt gleiche Nonce bei unterschiedlichem Zeitstempel (Event-Dedup-Fix)', () => {
    const ts1 = 1_779_280_908_187
    const ts2 = 1_779_280_530_329
    const out = mapInboxApiRowsToMessages([
      { sender: '0xs', text: 'ffg', nonce: '1', ts: ts1, isPlain: false, chainPurgeable: false },
      { sender: '0xs', text: 'neu', nonce: '1', ts: ts2, isPlain: false, chainPurgeable: false },
    ])
    expect(out).toHaveLength(2)
    expect(out.map((m) => m.content).sort()).toEqual(['ffg', 'neu'])
  })

  it('nutzt from wenn sender fehlt', () => {
    const out = mapInboxApiRowsToMessages([{ from: '0xf', text: 'a', timestamp: 100 }])
    expect(out[0]!.from).toBe('0xf')
  })

  it('bevorzugt längeren Inhalt bei gleichem MORG-Marker-Status', () => {
    const out = mapInboxApiRowsToMessages([
      { from: '0xf', text: 'short', content: 'longer body', timestamp: 50 },
    ])
    expect(out[0]!.content).toBe('longer body')
  })

  it('sortiert absteigend nach timestamp', () => {
    const out = mapInboxApiRowsToMessages([
      { from: 'a', text: '1', timestamp: 10 },
      { from: 'b', text: '2', timestamp: 99 },
      { from: 'c', text: '3', timestamp: 50 },
    ])
    expect(out.map((x) => x.timestamp)).toEqual([99, 50, 10])
  })

  it('nutzt große Nonce-Zahl als Zeitstempel-Fallback', () => {
    const big = 1_700_000_000_001
    const out = mapInboxApiRowsToMessages([{ from: '0xf', text: 'x', nonce: String(big) }])
    expect(out[0]!.timestamp).toBe(big)
  })

  it('setzt pinnwandPost wenn Wire-Marker vor Anzeige-Normalisierung', () => {
    const out = mapInboxApiRowsToMessages([
      {
        from: `0x${'a'.repeat(64)}`,
        text: '[[MORG_PINNWAND_V1]]Lage',
        recipient: `0x${'a'.repeat(64)}`,
        timestamp: 100,
        isPlain: true,
      },
    ])
    expect(out[0]!.content).toBe('Lage')
    expect(out[0]!.pinnwandPost).toBe(true)
  })

  it('nutzt nonce=1 nicht als Zeitstempel (sonst Sortierung 1970)', () => {
    const out = mapInboxApiRowsToMessages([
      { from: '0xf', text: 'enc', nonce: '1', isPlain: false },
      { from: '0xf', text: 'neu', timestamp: 1_779_000_000_000, isPlain: true },
    ])
    expect(out.find((m) => m.chainNonce === '1')!.timestamp).toBe(0)
    expect(out[0]!.content).toBe('neu')
  })
})
