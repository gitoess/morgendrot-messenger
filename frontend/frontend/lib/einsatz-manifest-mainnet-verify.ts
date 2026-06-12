'use client'

import type { EinsatzManifestAnchorRow } from '@morgendrot/core/iota'
import type { EinsatzManifestV1 } from '@/frontend/lib/einsatz-manifest-v1'
import { listEinsatzManifestAnchorsOnMainnet } from '@/frontend/lib/einsatz-manifest-anchors-list'
import type { ApiStatus } from '@/frontend/lib/api'

export type MainnetManifestMatchResult =
    | { ok: true; row: EinsatzManifestAnchorRow }
    | { ok: false; error: string; partial?: EinsatzManifestAnchorRow }

function normalizeHash(h: string | undefined): string {
    return (h ?? '').trim().toLowerCase().replace(/^0x/, '')
}

/** Findet on-chain-Anker mit passender Sequenz + manifest_hash. */
export function findMainnetAnchorForManifest(
    manifest: EinsatzManifestV1,
    rows: readonly EinsatzManifestAnchorRow[]
): EinsatzManifestAnchorRow | null {
    const mh = normalizeHash(manifest.manifest_hash)
    if (!mh) return null
    return (
        rows.find(
            (r) =>
                r.sequence === manifest.sequence &&
                normalizeHash(r.manifestHashHex) === mh
        ) ?? null
    )
}

/** § H.33d — Manifest gegen Mainnet-Registry (RPC). */
export async function verifyEinsatzManifestOnMainnetRegistry(opts: {
    manifest: EinsatzManifestV1
    apiStatus?: ApiStatus | null
}): Promise<MainnetManifestMatchResult> {
    const listed = await listEinsatzManifestAnchorsOnMainnet({ apiStatus: opts.apiStatus })
    if (!listed.ok) {
        return { ok: false, error: listed.error }
    }
    const row = findMainnetAnchorForManifest(opts.manifest, listed.rows)
    if (!row) {
        const seqOnly = listed.rows.find((r) => r.sequence === opts.manifest.sequence)
        if (seqOnly) {
            return {
                ok: false,
                error: `Sequenz ${opts.manifest.sequence} on-chain, aber manifest_hash weicht ab.`,
                partial: seqOnly,
            }
        }
        return {
            ok: false,
            error: `Kein Mainnet-Anker für Sequenz ${opts.manifest.sequence}.`,
        }
    }
    const rootOnChain = normalizeHash(row.merkleRootHex)
    const rootLocal = normalizeHash(opts.manifest.merkle_root)
    if (rootOnChain && rootLocal && rootOnChain !== rootLocal) {
        return { ok: false, error: 'merkle_root weicht vom Mainnet-Anker ab.', partial: row }
    }
    return { ok: true, row }
}
