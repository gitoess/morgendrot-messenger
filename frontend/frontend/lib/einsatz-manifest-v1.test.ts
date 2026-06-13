import { describe, expect, it } from 'vitest'
import { buildEinsatzManifestV1, merkleRootFromEntryHashes } from './einsatz-manifest-v1'
import type { Message } from '@/frontend/lib/types'

const PKG = '0x' + 'a'.repeat(64)

function msg(id: string, ts: number, content: string): Message {
    return {
        id,
        from: '0x' + 'b'.repeat(64),
        content,
        timestamp: ts,
        encrypted: false,
    }
}

describe('einsatz-manifest-v1', () => {
    it('merkle_root stabil bei gleicher Sortierung', async () => {
        const a = 'a'.repeat(64)
        const b = 'b'.repeat(64)
        const r1 = await merkleRootFromEntryHashes([b, a].sort())
        const r2 = await merkleRootFromEntryHashes([a, b].sort())
        expect(r1).toBe(r2)
        expect(r1).toHaveLength(64)
    })

    it('baut Manifest mit Hash und Einträgen', async () => {
    const manifest = await buildEinsatzManifestV1({
        einsatzId: 'einsatz-demo',
        packageId: PKG,
        chainMode: 'testnet-with-mainnet-anchor',
        rpcUrl: 'https://api.testnet.iota.cafe',
        messages: [msg('1', 1000, 'Hallo'), msg('2', 2000, 'Welt')],
    })
    expect(manifest.manifest_version).toBe(1)
    expect(manifest.entries).toHaveLength(2)
    expect(manifest.manifest_hash).toHaveLength(64)
    expect(manifest.source_network).toBe('testnet')
    expect(manifest.entries[0]?.content_sha256_hex).toHaveLength(64)
    expect(manifest.entries[0]?.evidence_status).toBe('local_only')
    })
})
