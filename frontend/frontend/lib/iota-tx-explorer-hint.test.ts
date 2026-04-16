import { describe, it, expect } from 'vitest'
import { explorerTxUrlFromDigest, formatTxDigestStatusSuffix } from '@/frontend/lib/iota-tx-explorer-hint'

describe('iota-tx-explorer-hint', () => {
  it('explorerTxUrlFromDigest: Standardpfad', () => {
    const d = 'a'.repeat(64)
    expect(explorerTxUrlFromDigest(d)).toContain('/txblock/')
    expect(explorerTxUrlFromDigest(d)).toContain(d)
  })

  it('formatTxDigestStatusSuffix: leer ohne Digest', () => {
    expect(formatTxDigestStatusSuffix()).toBe('')
    expect(formatTxDigestStatusSuffix('')).toBe('')
  })

  it('formatTxDigestStatusSuffix: enthält Kurzform und URL', () => {
    const d = 'b'.repeat(64)
    const s = formatTxDigestStatusSuffix(d)
    expect(s.startsWith(' · Tx ')).toBe(true)
    expect(s).toContain('http')
  })
})
