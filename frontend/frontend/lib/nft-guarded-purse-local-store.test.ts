import { describe, expect, it } from 'vitest'
import { iotaDecimalToMist, nftGuardedPurseBadgeText } from '@/frontend/lib/nft-guarded-purse-local-store'

describe('nft-guarded-purse-local-store', () => {
  it('iotaDecimalToMist', () => {
    expect(iotaDecimalToMist('1')).toBe(1_000_000_000n)
    expect(iotaDecimalToMist('0.01')).toBe(10_000_000n)
    expect(iotaDecimalToMist('1,5')).toBe(1_500_000_000n)
    expect(() => iotaDecimalToMist('')).toThrow()
    expect(() => iotaDecimalToMist('abc')).toThrow()
  })

  it('badge nennt Guarded und Purse-ID', () => {
    const t = nftGuardedPurseBadgeText({
      purseObjectId: '0x' + '11'.repeat(32),
      nftObjectId: '0x' + '22'.repeat(32),
      owner: '0x' + 'aa'.repeat(32),
      balanceMistHint: '1000000',
      status: 'active',
      updatedAtMs: 1,
    })
    expect(t).toMatch(/Guarded/i)
    expect(t).toMatch(/Purse/)
  })
})
