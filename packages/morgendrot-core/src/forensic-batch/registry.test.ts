import { describe, expect, it } from 'vitest'
import {
  mergeForensicBatchRegistryEntries,
  recordForensicBatchRegistryEntries,
} from './registry'

const refA = 'a'.repeat(64)
const refB = 'b'.repeat(64)
const digestA = '0x' + 'c'.repeat(64)
const digestB = '0x' + 'd'.repeat(64)
const digestOld = '0x' + 'e'.repeat(64)
const digestNew = '0x' + 'f'.repeat(64)

describe('forensic-batch registry (core)', () => {
  it('merge ersetzt bei neuerem batchedAtMs', () => {
    const prev = [
      {
        canonicalMsgRef: refA,
        batchDigest: digestOld,
        batchedAtMs: 100,
        encrypted: false,
      },
    ]
    const { merged, entries } = mergeForensicBatchRegistryEntries(
      prev,
      [{ canonicalMsgRef: refA, batchDigest: digestNew, batchedAtMs: 200, encrypted: true }],
      'merge'
    )
    expect(merged).toBe(1)
    expect(entries[0]?.batchDigest).toBe(digestNew)
    expect(entries[0]?.encrypted).toBe(true)
  })

  it('recordForensicBatchRegistryEntries dedupliziert nach ref', () => {
    const next = recordForensicBatchRegistryEntries(
      [],
      [
        { canonicalMsgRef: refB, batchDigest: digestA, encrypted: false },
        { canonicalMsgRef: refB, batchDigest: digestB, encrypted: true },
      ],
      500
    )
    expect(next).toHaveLength(1)
    expect(next[0]?.batchDigest).toBe(digestB)
  })
})
