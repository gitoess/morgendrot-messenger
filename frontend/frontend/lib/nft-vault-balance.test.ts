import { describe, expect, it } from 'vitest'
import {
  formatLocalMistHintAsIota,
  mistToIotaDecimal,
  parseMistBalanceFromMoveContent,
} from '@/frontend/lib/nft-vault-balance'

describe('nft-vault-balance', () => {
  it('mistToIotaDecimal', () => {
    expect(mistToIotaDecimal(0n)).toBe('0')
    expect(mistToIotaDecimal(1_000_000_000n)).toBe('1')
    expect(mistToIotaDecimal(10_000_000n)).toBe('0.01')
    expect(mistToIotaDecimal(1_500_000_000n)).toBe('1.5')
  })

  it('parseMistBalanceFromMoveContent string + nested', () => {
    expect(
      parseMistBalanceFromMoveContent({
        dataType: 'moveObject',
        fields: { balance: '10000000', owner: '0x1' },
      })
    ).toBe(10_000_000n)
    expect(
      parseMistBalanceFromMoveContent({
        fields: { balance: { fields: { value: '2500000000' }, type: '0x2::balance::Balance' } },
      })
    ).toBe(2_500_000_000n)
    expect(parseMistBalanceFromMoveContent({ fields: {} })).toBeNull()
  })

  it('formatLocalMistHintAsIota', () => {
    expect(formatLocalMistHintAsIota('10000000')).toMatch(/0\.01 IOTA/)
    expect(formatLocalMistHintAsIota('+10000000 (nach Deposit)')).toMatch(/0\.01/)
    expect(formatLocalMistHintAsIota('?')).toBeNull()
  })
})
