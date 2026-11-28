import { describe, expect, it } from 'vitest'
import {
  inboxExplorerBadgeLabel,
  resolveInboxMessageExplorerTarget,
} from '@/frontend/lib/inbox-message-explorer'
import type { Message } from '@/frontend/lib/types'

describe('inbox-message-explorer', () => {
  it('bevorzugt TX-Digest', () => {
    const msg = {
      id: '1',
      from: '0x' + 'aa'.repeat(32),
      content: 'hi',
      timestamp: 1,
      chainTxDigest: 'DigestABC123',
      chainMailboxObjectId: '0x' + 'bb'.repeat(32),
    } as Message
    const t = resolveInboxMessageExplorerTarget(msg)
    expect(t?.kind).toBe('tx')
    expect(t?.href).toContain('DigestABC123')
    expect(inboxExplorerBadgeLabel(t!)).toMatch(/^On-chain \(/)
  })

  it('fällt auf Mailbox-Objekt zurück', () => {
    const mb = '0x' + 'cc'.repeat(32)
    const msg = {
      id: '2',
      from: '0x' + 'aa'.repeat(32),
      content: 'hi',
      timestamp: 1,
      chainMailboxObjectId: mb,
      chainPurgeable: true,
    } as Message
    const t = resolveInboxMessageExplorerTarget(msg)
    expect(t?.kind).toBe('object')
    expect(t?.href).toContain(mb)
  })
})
