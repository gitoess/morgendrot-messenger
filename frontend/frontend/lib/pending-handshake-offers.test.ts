import { describe, it, expect } from 'vitest'
import { filterPendingHandshakesNotConnected } from '@/frontend/lib/pending-handshake-offers'

const ADDR_A = '0x' + 'aa'.repeat(32)
const ADDR_B = '0x' + 'bb'.repeat(32)

describe('filterPendingHandshakesNotConnected', () => {
  it('drops already connected senders', () => {
    const out = filterPendingHandshakesNotConnected(
      [
        { sender: ADDR_A, nonce: '1', source: 'event' },
        { sender: ADDR_B, nonce: '2', source: 'mailbox' },
      ],
      [ADDR_A]
    )
    expect(out).toHaveLength(1)
    expect(out[0]?.sender.toLowerCase()).toBe(ADDR_B.toLowerCase())
  })
})
