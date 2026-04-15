import { describe, it, expect } from 'vitest'
import {
  computeCanonicalMsgRefV1,
  normalizeMailboxAddressUtf8,
  stableOfflineMailboxThreadId,
} from './canonical-msg-ref.js'

describe('computeCanonicalMsgRefV1', () => {
  it('liefert 64 Kleinbuchstaben-Hex', async () => {
    const h = await computeCanonicalMsgRefV1({
      senderAddress: '0x' + '11'.repeat(32),
      recipientAddress: '0x' + '22'.repeat(32),
      threadId: 't1',
      messageNonceU64: BigInt(42),
      payloadUtf8: 'hello',
    })
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('ist deterministisch für gleiche Eingaben', async () => {
    const input = {
      senderAddress: '',
      recipientAddress: '0x' + 'aa'.repeat(32),
      threadId: stableOfflineMailboxThreadId('0x' + 'bb'.repeat(32), '0x' + 'aa'.repeat(32)),
      payloadUtf8: 'x',
    }
    const a = await computeCanonicalMsgRefV1(input)
    const b = await computeCanonicalMsgRefV1(input)
    expect(a).toBe(b)
  })

  it('unterscheidet Nutzlast', async () => {
    const base = {
      senderAddress: '0x' + '01'.repeat(32),
      recipientAddress: '0x' + '02'.repeat(32),
      threadId: '',
    }
    const u = await computeCanonicalMsgRefV1({ ...base, payloadUtf8: 'a' })
    const v = await computeCanonicalMsgRefV1({ ...base, payloadUtf8: 'b' })
    expect(u).not.toBe(v)
  })
})

describe('normalizeMailboxAddressUtf8', () => {
  it('normalisiert 0x+64 Hex zu Kleinbuchstaben', () => {
    expect(normalizeMailboxAddressUtf8('  0x' + 'AB'.repeat(32) + '  ')).toBe('0x' + 'ab'.repeat(32))
  })
})
