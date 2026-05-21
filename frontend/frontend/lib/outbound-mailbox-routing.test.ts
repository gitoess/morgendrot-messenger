import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'

const CONTACT_MB = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const PRIVATE_MB = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
const WALLET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

vi.mock('@/frontend/lib/my-private-mailbox-store', () => ({
  readActiveMailboxSelection: () => ({ kind: 'private' as const, objectId: PRIVATE_MB }),
  readCachedServerMailboxObjectId: () => '',
}))

describe('resolveOutboundMailboxObjectId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bevorzugt Kontakt-private Mailbox', () => {
    const dir = { [WALLET.toLowerCase()]: { mailboxObjectId: CONTACT_MB } }
    expect(resolveOutboundMailboxObjectId(dir, WALLET)).toBe(CONTACT_MB)
  })

  it('nutzt eigene aktive private Mailbox ohne Kontakt-Mapping', () => {
    expect(resolveOutboundMailboxObjectId({}, WALLET)).toBe(PRIVATE_MB)
  })
})
