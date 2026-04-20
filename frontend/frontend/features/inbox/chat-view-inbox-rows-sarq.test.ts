import { describe, expect, it } from 'vitest'
import { buildMorgSegV1Wire } from '@/frontend/lib/lora-sarq-wire'
import { buildChatInboxRows, morgSarqSegInboxGroupKey } from '@/frontend/features/inbox/chat-view-inbox-rows'
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
  it('gruppiert nach Absender, msgId, phase, n', () => {
    const raw = buildMorgSegV1Wire({ msgId: 'deadbeef', phase: 'luma', seg: 0, n: 2, raw: new Uint8Array([1]) })
    const k = morgSarqSegInboxGroupKey(msg({ id: '1', content: raw, timestamp: 1 }))
    expect(k).toBe('0xabc:deadbeef:luma:2')
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
})
