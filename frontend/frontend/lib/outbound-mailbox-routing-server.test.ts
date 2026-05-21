import { describe, it, expect, vi } from 'vitest'
import { resolveOutboundMailboxObjectId } from '@/frontend/lib/outbound-mailbox-routing'

const SERVER_MB = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const WALLET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

vi.mock('@/frontend/lib/my-private-mailbox-store', () => ({
  readActiveMailboxSelection: () => ({ kind: 'server' as const }),
  readCachedServerMailboxObjectId: () => SERVER_MB,
}))

describe('resolveOutboundMailboxObjectId (server aktiv)', () => {
  it('nutzt Server-MAILBOX_ID aus Status-Cache', () => {
    expect(resolveOutboundMailboxObjectId({}, WALLET)).toBe(SERVER_MB)
  })
})
