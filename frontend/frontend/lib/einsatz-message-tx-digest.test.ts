import { beforeEach, describe, expect, it } from 'vitest'
import { resolveInboxMessageTxDigest } from './einsatz-message-tx-digest'
import type { Message } from '@/frontend/lib/types'

describe('einsatz-message-tx-digest', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('findet Digest per chainNonce', () => {
        window.localStorage.setItem(
            'morgendrot.tangleInventory.v1',
            JSON.stringify([
                {
                    id: 'x:42:1000',
                    digest: 'abc123digest',
                    timestamp: 1000,
                    type: 'text',
                    status: 'anchored',
                    origin: 'mailbox',
                    nonce: '42',
                },
            ])
        )
        const msg: Message = {
            id: 'm1',
            from: '0x' + 'a'.repeat(64),
            content: 'Hi',
            timestamp: 1005,
            chainNonce: '42',
            chainPurgeable: true,
        }
        expect(resolveInboxMessageTxDigest(msg)).toBe('abc123digest')
    })

    it('bevorzugt chainTxDigest-Feld', () => {
        const msg: Message = {
            id: 'm2',
            from: '0x' + 'b'.repeat(64),
            content: 'Hi',
            timestamp: 1000,
            chainNonce: '99',
            chainTxDigest: 'from-api',
        }
        expect(resolveInboxMessageTxDigest(msg)).toBe('from-api')
    })
})
