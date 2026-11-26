import { describe, expect, it } from 'vitest'
import { vaultOnChainGasBudgetMist } from './chain-access.js'

describe('vaultOnChainGasBudgetMist', () => {
  it('liegt über dem historischen 10M-Default und skaliert mit Blob-Größe', () => {
    const floor = vaultOnChainGasBudgetMist(1_000)
    const large = vaultOnChainGasBudgetMist(200_000)
    expect(floor).toBeGreaterThanOrEqual(80_000_000)
    expect(large).toBeGreaterThan(floor)
    expect(large).toBeLessThanOrEqual(500_000_000)
  })
})
