import { describe, expect, it } from 'vitest'
import { estimateImageNftMintGasBudget, EVIDENCE_MINT_TARGET_BYTES } from '@/frontend/lib/evidence-image-mint-prepare'

describe('estimateImageNftMintGasBudget', () => {
  it('gibt mindestens 200M für kleine Bilder (8 KB waren mit 40M zu knapp)', () => {
    const g = estimateImageNftMintGasBudget(8184)
    expect(g).toBeGreaterThanOrEqual(200_000_000n)
    expect(g).toBeLessThanOrEqual(1_000_000_000n)
  })

  it('skaliert mit Bytes und capped bei 1B', () => {
    const small = estimateImageNftMintGasBudget(1_000)
    const big = estimateImageNftMintGasBudget(100_000)
    expect(big).toBeGreaterThan(small)
    expect(estimateImageNftMintGasBudget(10_000_000)).toBe(1_000_000_000n)
  })
})

describe('EVIDENCE_MINT_TARGET_BYTES', () => {
  it('liegt nahe am Chat-Compact-Limit', () => {
    expect(EVIDENCE_MINT_TARGET_BYTES).toBe(12_000)
  })
})
