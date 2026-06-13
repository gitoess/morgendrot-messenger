import { describe, expect, it } from 'vitest'
import {
  chainMessageLogicalDedupKey,
  nonceNeedsInboxKeyDisambiguation,
  resolveInboxRowDedupKey,
} from './chain-inbox-dedup'

const S = '0x' + '11'.repeat(32)
const R = '0x' + '22'.repeat(32)

describe('chain-inbox-dedup', () => {
  it('logical key ist unabhängig von Kanal', () => {
    const k = chainMessageLogicalDedupKey({ sender: S, recipient: R, nonce: '1781371408086' })
    expect(k).toBe(`chain-msg|${S.toLowerCase()}|${R.toLowerCase()}|1781371408086`)
  })

  it('ms-nonce nutzt logical dedup statt evid/mbp', () => {
    const k = resolveInboxRowDedupKey({
      sender: S,
      recipient: R,
      nonce: '1781371408086',
      timestamp: 1781371408086,
      inboxKey: 'evid:abc',
    })
    expect(k).toMatch(/^chain-msg\|/)
    expect(k).not.toContain('evid:')
  })

  it('nonce=1 behält inboxKey zur Trennung', () => {
    const k = resolveInboxRowDedupKey({
      sender: S,
      recipient: R,
      nonce: '1',
      timestamp: 100,
      inboxKey: 'evid:aaa',
    })
    expect(k).toBe('evid:aaa')
    expect(nonceNeedsInboxKeyDisambiguation('1')).toBe(true)
    expect(nonceNeedsInboxKeyDisambiguation('1781371408086')).toBe(false)
  })
})
