import { describe, expect, it } from 'vitest'
import {
  formatBurnSuccessUserMessage,
  storageRebateMistFromGasSummary,
} from './burn-success-message'

describe('burn-success-message', () => {
  it('storageRebateMistFromGasSummary — positiv', () => {
    expect(storageRebateMistFromGasSummary({ storageRebate: '12345000' })).toBe('12345000')
  })

  it('storageRebateMistFromGasSummary — 0 / fehlend', () => {
    expect(storageRebateMistFromGasSummary({ storageRebate: '0' })).toBeUndefined()
    expect(storageRebateMistFromGasSummary({})).toBeUndefined()
    expect(storageRebateMistFromGasSummary(null)).toBeUndefined()
  })

  it('formatBurnSuccessUserMessage — ohne Rebate = Basis', () => {
    expect(formatBurnSuccessUserMessage({ baseMessage: 'Nachricht geburnt.' })).toBe(
      'Nachricht geburnt.'
    )
    expect(formatBurnSuccessUserMessage({})).toBe('Nachricht geburnt (Storage-Rebate).')
  })

  it('formatBurnSuccessUserMessage — mit Rebate = Toast-Zeile', () => {
    expect(
      formatBurnSuccessUserMessage({
        baseMessage: 'ignored when rebate',
        storageRebateMist: '1000000000',
      })
    ).toBe('Burn ok · Rebate 1 IOTA')
  })
})
