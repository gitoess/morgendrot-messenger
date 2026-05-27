import { describe, it, expect, beforeEach } from 'vitest'
import {
  filterOutgoingHandshakesNotConnected,
  filterVisibleOutgoingHandshakes,
  filterPendingHandshakesNotConnected,
  filterVisiblePendingHandshakes,
  pickNewHandshakeOffersForNotify,
} from '@/frontend/lib/pending-handshake-offers'
import {
  dismissHandshakeOffer,
  dismissOutgoingHandshakeOffer,
  handshakeOfferFingerprint,
  readDismissedHandshakeFingerprints,
} from '@/frontend/lib/dismissed-handshake-offers'

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

describe('filterOutgoingHandshakesNotConnected', () => {
  it('drops already connected recipients', () => {
    const out = filterOutgoingHandshakesNotConnected(
      [
        { recipient: ADDR_A, nonce: '1', source: 'event' },
        { recipient: ADDR_B, nonce: '2', source: 'mailbox' },
      ],
      [ADDR_A]
    )
    expect(out).toHaveLength(1)
    expect(out[0]?.recipient.toLowerCase()).toBe(ADDR_B.toLowerCase())
  })
})

describe('filterVisiblePendingHandshakes', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear()
  })

  it('hides dismissed offers', () => {
    dismissHandshakeOffer(ADDR_B, '2')
    const dismissed = readDismissedHandshakeFingerprints()
    const out = filterVisiblePendingHandshakes(
      [
        { sender: ADDR_A, nonce: '1', source: 'event' },
        { sender: ADDR_B, nonce: '2', source: 'mailbox' },
      ],
      [],
      dismissed
    )
    expect(out).toHaveLength(1)
    expect(out[0]?.sender.toLowerCase()).toBe(ADDR_A.toLowerCase())
  })
})

describe('filterVisibleOutgoingHandshakes', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear()
  })

  it('hides dismissed outgoing offers', () => {
    dismissOutgoingHandshakeOffer(ADDR_B, '2')
    const out = filterVisibleOutgoingHandshakes(
      [
        { recipient: ADDR_A, nonce: '1', source: 'event' },
        { recipient: ADDR_B, nonce: '2', source: 'mailbox' },
      ],
      []
    )
    expect(out).toHaveLength(1)
    expect(out[0]?.recipient.toLowerCase()).toBe(ADDR_A.toLowerCase())
  })
})

describe('pickNewHandshakeOffersForNotify', () => {
  it('returns only not-yet-notified fingerprints', () => {
    const notified = new Set<string>()
    const offers = [{ sender: ADDR_A, nonce: '9', source: 'mailbox' as const }]
    const first = pickNewHandshakeOffersForNotify(offers, notified)
    expect(first).toHaveLength(1)
    const second = pickNewHandshakeOffersForNotify(offers, notified)
    expect(second).toHaveLength(0)
    expect(notified.has(handshakeOfferFingerprint(ADDR_A, '9'))).toBe(true)
  })
})
