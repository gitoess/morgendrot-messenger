import { describe, expect, it } from 'vitest'
import { buildMorgSegV1Wire } from '@/frontend/lib/lora-sarq-wire'
import {
  buildChatInboxRows,
  inboxMessageRowStableKey,
  morgSarqSegInboxGroupKey,
} from '@/frontend/features/inbox/chat-view-inbox-rows'
import type { Message } from '@/frontend/lib/types'

function msg(p: Partial<Message> & Pick<Message, 'id' | 'content' | 'timestamp'>): Message {
  return {
    from: '0xabc',
    recipient: 'mesh',
    encrypted: false,
    source: 'mesh',
    ...p,
  } as Message
}

describe('morgSarqSegInboxGroupKey', () => {
  it('gruppiert nach Absender + msgId (Luma und Chroma zusammen)', () => {
    const luma = buildMorgSegV1Wire({ msgId: 'deadbeef', phase: 'luma', seg: 0, n: 2, raw: new Uint8Array([1]) })
    const chroma = buildMorgSegV1Wire({
      msgId: 'deadbeef',
      phase: 'chroma',
      seg: 0,
      n: 1,
      raw: new Uint8Array([2]),
    })
    const kL = morgSarqSegInboxGroupKey(msg({ id: '1', content: luma, timestamp: 1 }))
    const kC = morgSarqSegInboxGroupKey(msg({ id: '2', content: chroma, timestamp: 2 }))
    expect(kL).toBe('0xabc:deadbeef')
    expect(kC).toBe(kL)
  })
})

describe('inboxMessageRowStableKey', () => {
  it('bleibt bei neuen Segmenten derselben Session gleich', () => {
    const a = buildMorgSegV1Wire({ msgId: 'deadbeef', phase: 'luma', seg: 0, n: 2, raw: new Uint8Array([1]) })
    const b = buildMorgSegV1Wire({ msgId: 'deadbeef', phase: 'luma', seg: 1, n: 2, raw: new Uint8Array([2]) })
    const k0 = inboxMessageRowStableKey(msg({ id: 'old', content: a, timestamp: 1 }))
    const k1 = inboxMessageRowStableKey(msg({ id: 'new', content: b, timestamp: 2 }))
    expect(k0).toBe(k1)
    expect(k0).not.toBe('old')
  })
})

describe('buildChatInboxRows S-ARQ collapse', () => {
  it('zeigt nur die neueste Zeile pro S-ARQ-Session', () => {
    const a = buildMorgSegV1Wire({ msgId: 'deadbeef', phase: 'luma', seg: 0, n: 2, raw: new Uint8Array([1]) })
    const b = buildMorgSegV1Wire({ msgId: 'deadbeef', phase: 'luma', seg: 1, n: 2, raw: new Uint8Array([2]) })
    const messages: Message[] = [
      msg({ id: 'old', content: a, timestamp: 100 }),
      msg({ id: 'new', content: b, timestamp: 200 }),
    ]
    const rows = buildChatInboxRows(messages, [])
    const msgRows = rows.filter((r) => r.kind === 'msg')
    expect(msgRows).toHaveLength(1)
    expect(msgRows[0]!.kind === 'msg' && msgRows[0]!.msg.id).toBe('new')
  })

  it('kollabiert Luma- und Chroma-Phase zu einer Zeile', () => {
    const luma = buildMorgSegV1Wire({ msgId: 'cafebabe', phase: 'luma', seg: 0, n: 1, raw: new Uint8Array([1]) })
    const chroma = buildMorgSegV1Wire({
      msgId: 'cafebabe',
      phase: 'chroma',
      seg: 0,
      n: 1,
      raw: new Uint8Array([2]),
    })
    const rows = buildChatInboxRows(
      [
        msg({ id: 'l', content: luma, timestamp: 100 }),
        msg({ id: 'c', content: chroma, timestamp: 250 }),
      ],
      []
    )
    const msgRows = rows.filter((r) => r.kind === 'msg')
    expect(msgRows).toHaveLength(1)
    expect(msgRows[0]!.kind === 'msg' && msgRows[0]!.msg.id).toBe('c')
  })

  it('blendet NAK/ACK aus dem Posteingang aus', () => {
    const seg = buildMorgSegV1Wire({
      msgId: 'deadbeef',
      phase: 'luma',
      seg: 0,
      n: 1,
      raw: new Uint8Array([1]),
    })
    const nak = '[[MORG_NAK_V1:msgId=deadbeef|phase=luma|mask=00000000]]'
    const rows = buildChatInboxRows(
      [
        msg({ id: 's', content: seg, timestamp: 1 }),
        msg({ id: 'n1', content: nak, timestamp: 2 }),
        msg({ id: 'n2', content: nak, timestamp: 3 }),
        msg({ id: 'hi', content: 'Hallo', timestamp: 4 }),
      ],
      []
    )
    const texts = rows.filter((r) => r.kind === 'msg').map((r) => (r.kind === 'msg' ? r.msg.content : ''))
    expect(texts.some((t) => t.includes('MORG_NAK'))).toBe(false)
    expect(texts).toContain('Hallo')
  })
})
