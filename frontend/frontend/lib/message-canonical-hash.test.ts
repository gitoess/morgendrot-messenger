import { describe, expect, it } from 'vitest'
import { hashInboxMessageCanonical, hashInboxMessagesCanonical } from '@/frontend/lib/message-canonical-hash'
import type { Message } from '@/frontend/lib/types'

const FROM = '0x' + 'a'.repeat(64)
const TO = '0x' + 'b'.repeat(64)

describe('hashInboxMessageCanonical', () => {
  it('ist stabil und ändert sich bei Inhaltsänderung', async () => {
    const base: Message = {
      id: 'm1',
      from: FROM,
      recipient: TO,
      content: 'Alarm Ost',
      timestamp: 1_700_000_000_000,
    }
    const a = await hashInboxMessageCanonical(base)
    const b = await hashInboxMessageCanonical({ ...base, id: 'other-id' })
    expect(a.entryHash).toBe(b.entryHash)
    expect(a.entryHash).toHaveLength(64)
    expect(a.clipboardText).toContain('entry_hash=')
    expect(a.clipboardText).toContain('schema=morgendrot-message-hash-v1')

    const c = await hashInboxMessageCanonical({ ...base, content: 'Alarm West' })
    expect(c.entryHash).not.toBe(a.entryHash)
  })

  it('hashInboxMessagesCanonical liefert Summary + Blöcke', async () => {
    const msgs: Message[] = [
      { id: '1', from: FROM, recipient: TO, content: 'a', timestamp: 1 },
      { id: '2', from: FROM, recipient: TO, content: 'b', timestamp: 2 },
    ]
    const r = await hashInboxMessagesCanonical(msgs)
    expect(r.hashes).toHaveLength(2)
    expect(r.summaryLines.split('\n')).toHaveLength(2)
    expect(r.clipboardText).toContain('--- Nachricht 1 ---')
    expect(r.clipboardText).toContain('--- Nachricht 2 ---')
  })
})
