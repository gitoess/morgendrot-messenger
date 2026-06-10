import { describe, it, expect } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import {
  buildGroupMailboxOptimisticInboxRows,
  chainMessageConfirmsOptimisticRow,
  pickInboxOverlayRowsForMerge,
  pickUnconfirmedMailboxOptimisticRows,
} from './group-inbox-optimistic'

const ME = '0x' + 'a'.repeat(64)
const PEER = '0x' + 'b'.repeat(64)
const TEAM = '0x' + 'f'.repeat(64)

describe('buildGroupMailboxOptimisticInboxRows', () => {
  it('team-broadcast: eine Zeile mit Team-Object-ID', () => {
    const rows = buildGroupMailboxOptimisticInboxRows({
      myAddress: ME,
      text: 'Hallo Team',
      encrypted: false,
      messageNonceU64: 42n,
      mode: 'team-broadcast',
      teamMailboxObjectId: TEAM,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.recipient).toBe(TEAM)
    expect(rows[0]?.from).toBe(ME)
    expect(rows[0]?.dedupKey).toContain('team:')
  })

  it('pairwise: je Ziel eine Zeile', () => {
    const rows = buildGroupMailboxOptimisticInboxRows({
      myAddress: ME,
      text: 'Hi',
      encrypted: false,
      messageNonceU64: 7n,
      mode: 'pairwise',
      pairwiseTargets: [PEER, '0x' + 'c'.repeat(64)],
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]?.recipient).toBe(PEER)
  })
})

describe('pickUnconfirmedMailboxOptimisticRows', () => {
  it('behält optimistic bis Chain bestätigt', () => {
    const opt = buildGroupMailboxOptimisticInboxRows({
      myAddress: ME,
      text: 'x',
      encrypted: false,
      messageNonceU64: 99n,
      mode: 'pairwise',
      pairwiseTargets: [PEER],
    })[0]!
    const pending = pickUnconfirmedMailboxOptimisticRows([opt], [])
    expect(pending).toHaveLength(1)

    const chain: Message = {
      id: 'chain:1',
      from: ME,
      recipient: PEER,
      content: 'x',
      timestamp: Date.now(),
      encrypted: false,
      chainNonce: '99',
      source: 'mailbox',
      transports: ['internet'],
    }
    expect(pickUnconfirmedMailboxOptimisticRows([opt], [chain])).toHaveLength(0)
    expect(chainMessageConfirmsOptimisticRow(chain, opt)).toBe(true)
  })

  it('pickInboxOverlayRowsForMerge behält optimistic beim Reset ohne Chain-Treffer', () => {
    const opt = buildGroupMailboxOptimisticInboxRows({
      myAddress: ME,
      text: 'warte',
      encrypted: false,
      messageNonceU64: 11n,
      mode: 'team-broadcast',
      teamMailboxObjectId: TEAM,
    })[0]!
    const overlay = pickInboxOverlayRowsForMerge([opt], [])
    expect(overlay.map((m) => m.id)).toContain(opt.id)
  })
})
