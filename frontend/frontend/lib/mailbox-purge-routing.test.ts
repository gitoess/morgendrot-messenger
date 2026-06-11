import { describe, expect, it } from 'vitest'
import {
  isTeamBroadcastInboxMessage,
  resolveMailboxPurgeTarget,
  teamBroadcastPurgeHint,
} from '@/frontend/lib/mailbox-purge-routing'
import type { Message } from '@/frontend/lib/types'

const ME = '0x' + 'aa'.repeat(32)
const PEER = '0x' + 'bb'.repeat(32)
const TEAM_MB = '0x' + 'cc'.repeat(32)

describe('mailbox-purge-routing', () => {
  it('erkennt Team-Broadcast an inboxKey', () => {
    const msg: Message = {
      id: 'x',
      from: ME,
      recipient: TEAM_MB,
      content: 'hi',
      timestamp: 1,
      dedupKey: `team:${TEAM_MB}:${ME}:123`,
      chainNonce: '123',
      chainPurgeable: true,
    }
    expect(isTeamBroadcastInboxMessage(msg)).toBe(true)
    const t = resolveMailboxPurgeTarget(msg, PEER)
    expect(t?.kind).toBe('team-broadcast')
    if (t?.kind === 'team-broadcast') {
      expect(t.teamMailboxObjectId).toBe(TEAM_MB)
      expect(t.broadcastSender).toBe(ME)
    }
  })

  it('pairwise 1:1', () => {
    const msg: Message = {
      id: 'p',
      from: PEER,
      recipient: ME,
      content: '1:1',
      timestamp: 1,
      chainNonce: '7',
      chainPurgeable: true,
      encrypted: false,
    }
    const t = resolveMailboxPurgeTarget(msg, ME)
    expect(t?.kind).toBe('pairwise')
  })

  it('team hint für fremden Sender', () => {
    const msg: Message = {
      id: 't',
      from: PEER,
      recipient: TEAM_MB,
      content: 'g',
      timestamp: 1,
      chainPurgeKind: 'team-broadcast',
      chainNonce: '1',
      chainPurgeable: true,
    }
    expect(teamBroadcastPurgeHint(msg, ME)).toContain('TTL')
  })
})
