import { describe, expect, it } from 'vitest'
import { mailboxHybridErr } from '@/frontend/features/send/chat-view-handle-send-mailbox'

describe('mailboxHybridErr', () => {
  it('prefers string error field', () => {
    expect(mailboxHybridErr({ error: '  chain timeout  ', message: 'ignored' })).toBe('chain timeout')
  })

  it('falls back to string message field', () => {
    expect(mailboxHybridErr({ message: 'mailbox full' })).toBe('mailbox full')
  })

  it('formats non-string error via formatUnknownError', () => {
    expect(mailboxHybridErr({ error: new Error('boom') })).toBe('boom')
  })

  it('returns Fehler when nothing usable', () => {
    expect(mailboxHybridErr({})).toBe('Fehler')
  })
})
