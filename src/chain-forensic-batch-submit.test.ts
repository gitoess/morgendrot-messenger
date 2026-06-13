/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
    assertForensicBatchItemCount,
    forensicEncryptedBatchFallbackReason,
    forensicPlaintextBatchFallbackReason,
    isForensicMailboxPairValid,
} from './chain-forensic-batch-submit.js'

describe('chain-forensic-batch-submit', () => {
    it('assertForensicBatchItemCount wirft über Limit', () => {
        expect(() => assertForensicBatchItemCount(51)).toThrow(/50/)
        expect(() => assertForensicBatchItemCount(50)).not.toThrow()
    })

    it('isForensicMailboxPairValid prüft Package ≠ Mailbox', () => {
        const id = '0x' + 'a'.repeat(64)
        const other = '0x' + 'b'.repeat(64)
        expect(isForensicMailboxPairValid(id, other)).toBe(true)
        expect(isForensicMailboxPairValid(id, id)).toBe(false)
        expect(isForensicMailboxPairValid('', other)).toBe(false)
    })

    it('Fallback-Gründe sind strings oder null', () => {
        const plain = forensicPlaintextBatchFallbackReason(
            () => false,
            () => true,
            () => undefined
        )
        expect(typeof plain === 'string' || plain === null).toBe(true)
        const enc = forensicEncryptedBatchFallbackReason(() => undefined)
        expect(typeof enc === 'string' || enc === null).toBe(true)
    })
})
