import { describe, expect, it } from 'vitest'
import {
  mergeForensicBatchRegistryEntries,
  recordForensicBatchRegistryEntries,
} from './registry'

const refA = 'a'.repeat(64)
const refB = 'b'.repeat(64)

describe('forensic-batch registry (core)', () => {
  it('merge ersetzt bei neuerem batchedAtMs', () => {
    const prev = [
      {
        canonicalMsgRef: refA,
        batchDigest: 'old',
        batchedAtMs: 100,
        encrypted: false,
      },
    ]
    const { merged, entries } = mergeForensicBatchRegistryEntries(
      prev,
      [{ canonicalMsgRef: refA, batchDigest: 'new', batchedAtMs: 200, encrypted: true }],
      'merge'
    )
    expect(merged).toBe(1)
    expect(entries[0]?.batchDigest).toBe('new')
    expect(entries[0]?.encrypted).toBe(true)
  })

  it('recordForensicBatchRegistryEntries dedupliziert nach ref', () => {
    const next = recordForensicBatchRegistryEntries(
      [],
      [
        { canonicalMsgRef: refB, batchDigest: 'd1', encrypted: false },
        { canonicalMsgRef: refB, batchDigest: 'd2', encrypted: true },
      ],
      500
    )
    expect(next).toHaveLength(1)
    expect(next[0]?.batchDigest).toBe('d2')
  })
})
