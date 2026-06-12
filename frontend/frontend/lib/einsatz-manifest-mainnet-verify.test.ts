import { describe, expect, it } from 'vitest'
import { findMainnetAnchorForManifest } from './einsatz-manifest-mainnet-verify'
import type { EinsatzManifestV1 } from './einsatz-manifest-v1'

const HASH = 'ab'.repeat(32)

function manifest(overrides: Partial<EinsatzManifestV1> = {}): EinsatzManifestV1 {
    return {
        manifest_version: 1,
        einsatz_id: 'demo',
        period_start_ms: 1,
        period_end_ms: 2,
        source_network: 'mainnet',
        source_package_id: '0x' + 'a'.repeat(64),
        entries: [],
        merkle_root: 'cd'.repeat(32),
        sequence: 3,
        manifest_hash: HASH,
        ...overrides,
    }
}

describe('findMainnetAnchorForManifest', () => {
    it('findet passenden Anker', () => {
        const row = findMainnetAnchorForManifest(manifest(), [
            { sequence: 2, einsatzIdMoveAddress: '0x' + 'b'.repeat(64) },
            { sequence: 3, einsatzIdMoveAddress: '0x' + 'b'.repeat(64), manifestHashHex: HASH },
        ])
        expect(row?.sequence).toBe(3)
    })
})
