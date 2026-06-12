import { describe, expect, it } from 'vitest'
import {
    buildMerkleProofForEntryHash,
    verifyMerkleProofForEntryHash,
    verifySampleMerkleProofForManifest,
} from './einsatz-manifest-merkle-proof'
import { merkleRootFromEntryHashes } from './einsatz-manifest-v1'

describe('einsatz-manifest-merkle-proof', () => {
    it('Proof roundtrip für drei Blätter', async () => {
        const leaves = ['aa'.repeat(32), 'bb'.repeat(32), 'cc'.repeat(32)].sort()
        const root = await merkleRootFromEntryHashes(leaves)
        const built = await buildMerkleProofForEntryHash(leaves, leaves[1]!)
        expect(built.ok).toBe(true)
        if (!built.ok) return
        const ok = await verifyMerkleProofForEntryHash({
            entryHashHex: leaves[1]!,
            proof: built.proof,
            merkleRootHex: root,
            leafIndex: built.leafIndex,
        })
        expect(ok).toBe(true)
    })

    it('verifySampleMerkleProofForManifest', async () => {
        const leaves = ['11'.repeat(32), '22'.repeat(32)]
        const root = await merkleRootFromEntryHashes(leaves)
        const out = await verifySampleMerkleProofForManifest({
            sortedEntryHashesHex: leaves,
            merkleRootHex: root,
        })
        expect(out.ok).toBe(true)
    })
})
