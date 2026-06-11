import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectInboxAlsoMailboxIds } from '@/frontend/lib/inbox-also-mailbox-ids'

const MB_TEAM = '0xa8eb1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
const MB_OTHER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

vi.mock('@/frontend/lib/messenger-group-store', () => ({
  readMessengerGroups: vi.fn(() => [
    {
      id: 'g1',
      name: 'Alpha',
      memberAddresses: ['0x' + '1'.repeat(64)],
      teamMailboxObjectId: MB_TEAM,
      useTeamBroadcast: true,
    },
  ]),
}))

vi.mock('@/frontend/lib/my-team-mailbox-store', () => ({
  readMyTeamMailboxes: vi.fn(() => [{ objectId: MB_OTHER, label: 'Bravo' }]),
}))

describe('collectInboxAlsoMailboxIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sammelt Team-Mailboxen aus Gruppen und lokalem Store dedupliziert', () => {
    const ids = collectInboxAlsoMailboxIds()
    expect(ids).toHaveLength(2)
    expect(ids.map((x) => x.toLowerCase())).toContain(MB_TEAM.toLowerCase())
    expect(ids.map((x) => x.toLowerCase())).toContain(MB_OTHER.toLowerCase())
  })
})
