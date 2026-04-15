import { describe, it, expect } from 'vitest'
import {
  parseMailboxOutNonceMarker,
  parseMailboxProtocolNonceU64FromWire,
  prependMailboxOutNonceMarker,
} from './mailbox-out-nonce-wire'

describe('mailbox-out-nonce-wire', () => {
  it('prepend + parse roundtrip', () => {
    const n = BigInt(42)
    const w = prependMailboxOutNonceMarker('hello', n)
    const p = parseMailboxOutNonceMarker(w)
    expect(p?.nonce).toBe(n)
    expect(p?.rest).toBe('hello')
    expect(parseMailboxProtocolNonceU64FromWire(w)).toBe(n)
  })

  it('ohne Marker → null', () => {
    expect(parseMailboxOutNonceMarker('plain')).toBe(null)
    expect(parseMailboxProtocolNonceU64FromWire('plain')).toBe(null)
  })

  it('leerer Body nach Marker erlaubt', () => {
    const w = prependMailboxOutNonceMarker('', BigInt(1))
    expect(parseMailboxOutNonceMarker(w)?.rest).toBe('')
  })
})
