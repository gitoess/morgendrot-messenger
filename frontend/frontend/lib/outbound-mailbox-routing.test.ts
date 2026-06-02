import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'

const CONTACT_MB = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const PRIVATE_MB = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
const WALLET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

vi.mock('@/frontend/lib/my-mailbox-active', () => ({
  readActiveSendMailboxObjectId: () => PRIVATE_MB,
}))
vi.mock('@/frontend/lib/my-private-mailbox-store', () => ({
  readCachedServerMailboxObjectId: () => '',
}))

describe('resolveOutboundMailboxObjectId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bevorzugt Kontakt-private Mailbox', () => {
    const dir = { [WALLET.toLowerCase()]: { label: 'T', mailboxPrivateId: CONTACT_MB } }
    expect(resolveOutboundMailboxObjectId(dir, WALLET, 'private')).toBe(CONTACT_MB)
  })

  it('nutzt Composer-Mailbox-0x wenn gesetzt', () => {
    expect(resolveOutboundMailboxObjectId({}, WALLET, undefined, PRIVATE_MB)).toBe(PRIVATE_MB)
  })

  it('ohne Composer-Mailbox kein Fallback (Event)', () => {
    expect(resolveOutboundMailboxObjectId({}, WALLET)).toBeUndefined()
  })
})
