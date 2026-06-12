import { beforeEach, describe, expect, it } from 'vitest'
import { enrichInboxMessagesWithChainDigests } from './enrich-inbox-messages-chain-digest'
import type { Message } from '@/frontend/lib/types'

describe('enrichInboxMessagesWithChainDigests', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('setzt chainTxDigest aus Tangle-Inventar', () => {
        window.localStorage.setItem(
            'morgendrot.tangleInventory.v1',
            JSON.stringify([
                {
                    id: 'x:7:1000',
                    digest: 'digest-seven',
                    timestamp: 1000,
                    type: 'text',
                    status: 'anchored',
                    origin: 'mailbox',
                    nonce: '7',
                },
            ])
        )
        const msg: Message = {
            id: 'm1',
            from: '0x' + 'a'.repeat(64),
            content: 'Hi',
            timestamp: 1000,
            chainNonce: '7',
        }
        const [out] = enrichInboxMessagesWithChainDigests([msg])
        expect(out.chainTxDigest).toBe('digest-seven')
    })
})
