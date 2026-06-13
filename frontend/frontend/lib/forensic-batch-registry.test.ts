import { beforeEach, describe, expect, it } from 'vitest'
import {
  countForensicBatchRegistry,
  lookupForensicBatchEntry,
  readForensicBatchCanonicalRefSet,
  recordForensicBatchEntries,
} from './forensic-batch-registry'

describe('forensic-batch-registry', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('speichert canonical_msg_ref und Digest', () => {
    const ref = 'a'.repeat(64)
    const digest = '0x' + 'b'.repeat(64)
    recordForensicBatchEntries([
      { canonicalMsgRef: ref, batchDigest: digest, encrypted: false, messageId: 'm1' },
    ])
    expect(countForensicBatchRegistry()).toBe(1)
    expect(lookupForensicBatchEntry(ref)?.batchDigest).toBe(digest)
    expect(readForensicBatchCanonicalRefSet().has(ref)).toBe(true)
  })
})
