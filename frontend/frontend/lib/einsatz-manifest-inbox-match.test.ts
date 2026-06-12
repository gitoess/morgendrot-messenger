import { describe, expect, it } from 'vitest'
import { buildEinsatzManifestV1 } from './einsatz-manifest-v1'
import { matchEinsatzManifestAgainstInbox } from './einsatz-manifest-inbox-match'
import type { Message } from '@/frontend/lib/types'

const PKG = '0x' + 'a'.repeat(64)
const FROM = '0x' + 'b'.repeat(64)

const MSGS: Message[] = [
    { id: '1', from: FROM, content: 'Hallo', timestamp: 1000, encrypted: false },
    { id: '2', from: FROM, content: 'Welt', timestamp: 2000, encrypted: false },
]

describe('einsatz-manifest-inbox-match', () => {
    it('findet übereinstimmende Einträge', async () => {
        const manifest = await buildEinsatzManifestV1({
            einsatzId: 'demo',
            packageId: PKG,
            chainMode: 'mainnet-direct',
            messages: MSGS,
        })
        const r = await matchEinsatzManifestAgainstInbox(manifest, MSGS)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.matchedCount).toBe(2)
            expect(r.manifestOnlyCount).toBe(0)
            expect(r.inboxOnlyCount).toBe(0)
        }
    })

    it('meldet fehlende Treffer', async () => {
        const manifest = await buildEinsatzManifestV1({
            einsatzId: 'demo',
            packageId: PKG,
            chainMode: 'mainnet-direct',
            messages: MSGS,
        })
        const r = await matchEinsatzManifestAgainstInbox(manifest, [])
        expect(r.ok).toBe(false)
    })
})
