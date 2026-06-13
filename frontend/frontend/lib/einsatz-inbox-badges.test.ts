import { beforeEach, describe, expect, it } from 'vitest'
import {
    isMessageInEinsatzAnchor,
    isMessageOnChainMainnet,
    resolveEinsatzInboxMessageBadges,
    resolveForensicBatchBadge,
} from './einsatz-inbox-badges'
import { recordForensicBatchEntries } from './forensic-batch-registry'
import type { Message } from '@/frontend/lib/types'

const FROM = '0x' + 'b'.repeat(64)

function msg(overrides: Partial<Message> = {}): Message {
    return {
        id: '1',
        from: FROM,
        content: 'Hallo',
        timestamp: 1000,
        encrypted: false,
        ...overrides,
    }
}

describe('einsatz-inbox-badges', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('On-chain (Mainnet) nur bei chainPurgeable in Modus B', () => {
        expect(isMessageOnChainMainnet(msg({ chainPurgeable: true }), 'mainnet-direct')).toBe(true)
        expect(isMessageOnChainMainnet(msg({ chainPurgeable: false }), 'mainnet-direct')).toBe(false)
        expect(isMessageOnChainMainnet(msg({ chainPurgeable: true, source: 'mesh' }), 'mainnet-direct')).toBe(
            false
        )
    })

    it('kein Mainnet-Badge in Modus A', () => {
        expect(isMessageOnChainMainnet(msg({ chainPurgeable: true }), 'testnet-with-mainnet-anchor')).toBe(
            false
        )
    })

    it('Anker-Badge bei bekannter entry_hash', () => {
        const hash = 'a'.repeat(64)
        const anchored = new Set([hash])
        expect(isMessageInEinsatzAnchor(hash, anchored, 'mainnet-direct')).toBe(true)
        expect(isMessageInEinsatzAnchor('b'.repeat(64), anchored, 'mainnet-direct')).toBe(false)
    })

    it('kein Anker-Badge ohne Rollup-UI (Modus C)', () => {
        const hash = 'a'.repeat(64)
        expect(isMessageInEinsatzAnchor(hash, new Set([hash]), 'mainnet-direct-no-rollup')).toBe(false)
    })

    it('resolve kombiniert beide Badges', () => {
        const hash = 'c'.repeat(64)
        const badges = resolveEinsatzInboxMessageBadges(
            msg({ chainPurgeable: true }),
            'mainnet-direct',
            hash,
            new Set([hash])
        )
        expect(badges.onChainMainnet).toBe(true)
        expect(badges.inEinsatzAnchor).toBe(true)
        expect(badges.inForensicBatch).toBe(false)
    })

    it('Batch-Badge bei Registry-Treffer', () => {
        const ref = 'f'.repeat(64)
        recordForensicBatchEntries([{ canonicalMsgRef: ref, batchDigest: '0x' + 'ab'.repeat(32), encrypted: true }])
        const batch = resolveForensicBatchBadge(ref)
        expect(batch.inForensicBatch).toBe(true)
        expect(batch.forensicBatchDigest).toBe('0x' + 'ab'.repeat(32))
    })
})
