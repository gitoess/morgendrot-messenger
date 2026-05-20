import { describe, it, expect } from 'vitest'
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
    expect(m.dedupKey).toBe('mailbox|0xs|n1|hi')
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
})
