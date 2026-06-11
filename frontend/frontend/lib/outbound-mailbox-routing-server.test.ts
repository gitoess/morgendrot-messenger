import { describe, it, expect, vi } from 'vitest'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'

const SERVER_MB = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const WALLET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

vi.mock('@/frontend/lib/my-mailbox-active', () => ({
  readActiveSendMailboxObjectId: () => '',
}))
vi.mock('@/frontend/lib/my-private-mailbox-store', () => ({
  readCachedServerMailboxObjectId: () => SERVER_MB,
}))

describe('resolveOutboundMailboxObjectId (nur Shared)', () => {
  it('nutzt Server-MAILBOX_ID aus Status-Cache', () => {
    expect(resolveOutboundMailboxObjectId({}, WALLET, 'shared')).toBe(SERVER_MB)
  })
})
