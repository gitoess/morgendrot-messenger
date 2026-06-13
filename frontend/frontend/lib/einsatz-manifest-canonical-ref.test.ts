import { describe, expect, it } from 'vitest'
import { prependMailboxOutNonceMarker } from '@morgendrot/core/queue/offline-mailbox'
import { buildEinsatzManifestCanonicalMsgRef } from './einsatz-manifest-canonical-ref'
import type { Message } from '@/frontend/lib/types'

const FROM = '0x' + 'a'.repeat(64)
const TO = '0x' + 'b'.repeat(64)

describe('buildEinsatzManifestCanonicalMsgRef', () => {
    it('ist stabil bei gleichem Wire + chainNonce', async () => {
        const nonce = 42n
        const wire = prependMailboxOutNonceMarker('Hallo Welt', nonce)
        const msg: Message = {
            id: 'm1',
            from: FROM,
            recipient: TO,
            content: wire,
            timestamp: 1000,
            chainNonce: '42',
            encrypted: false,
        }
        const a = await buildEinsatzManifestCanonicalMsgRef(msg)
        const b = await buildEinsatzManifestCanonicalMsgRef({ ...msg, id: 'm2' })
        expect(a).toHaveLength(64)
        expect(a).toBe(b)
    })

    it('unterscheidet sich vom alten Platzhalter (id|from|ts|len)', async () => {
        const msg: Message = {
            id: 'm1',
            from: FROM,
            recipient: TO,
            content: 'Plain',
            timestamp: 1000,
            encrypted: false,
        }
        const ref = await buildEinsatzManifestCanonicalMsgRef(msg)
        const { sha256HexUtf8 } = await import('./einsatzprotokoll-anchor')
        const oldPlaceholder = await sha256HexUtf8(`${msg.id}|${msg.from}|${msg.timestamp}|${(msg.content ?? '').length}`)
        expect(ref).not.toBe(oldPlaceholder)
    })
})
