import { describe, expect, it, vi } from 'vitest'
import { defaultContactSendMailboxTarget } from './contact-send-mailbox-default'

vi.mock('@/frontend/lib/my-mailbox-active', () => ({
  readActiveSendMailboxObjectId: () => '0x' + 'a'.repeat(64),
}))

vi.mock('@/frontend/lib/my-private-mailbox-store', () => ({
  readCachedServerMailboxObjectId: () => '0x' + 'b'.repeat(64),
}))

describe('defaultContactSendMailboxTarget', () => {
  it('Consumer → Event', () => {
    expect(defaultContactSendMailboxTarget({ deploymentProfile: 'consumer' } as never)).toBe('event')
    expect(defaultContactSendMailboxTarget({ simpleMode: true } as never)).toBe('event')
  })

  it('Einsatz → aktive Mailbox', () => {
    expect(defaultContactSendMailboxTarget({ deploymentProfile: 'einsatz', simpleMode: false } as never)).toBe('own')
  })
})
