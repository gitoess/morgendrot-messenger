import { describe, it, expect } from 'vitest'
import { canAttemptHandshakeOnChainPurge } from '@/frontend/lib/handshake-offer-delete'

const MB = '0x' + 'aa'.repeat(32)

describe('canAttemptHandshakeOnChainPurge', () => {
  it('returns false for event-only', () => {
    expect(canAttemptHandshakeOnChainPurge('event', { mailboxId: MB, locked: false })).toBe(false)
  })

  it('returns false when vault locked', () => {
    expect(canAttemptHandshakeOnChainPurge('mailbox', { mailboxId: MB, locked: true })).toBe(false)
  })

  it('returns true for mailbox source with mailboxId', () => {
    expect(canAttemptHandshakeOnChainPurge('mailbox', { mailboxId: MB, locked: false })).toBe(true)
  })
})
