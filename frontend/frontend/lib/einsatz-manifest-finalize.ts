'use client'

import {
    computeEinsatzManifestHash,
    manifestBodyForHash,
    type EinsatzManifestV1,
} from '@/frontend/lib/einsatz-manifest-v1'
import { enrichEinsatzManifestChainEvidence } from '@/frontend/lib/einsatz-manifest-chain-enrich'
import { looksLikeHttpRpcUrl } from '@/frontend/lib/einsatz-manifest-rpc'

/** RPC-Zeitstempel anhängen und `manifest_hash` neu berechnen (Testnet→Mainnet-Beweis). */
export async function finalizeEinsatzManifestWithChainEvidence(
    manifest: EinsatzManifestV1,
    rpcUrl: string | undefined
): Promise<EinsatzManifestV1> {
    const rpc = rpcUrl?.trim()
    if (!rpc || !looksLikeHttpRpcUrl(rpc)) return manifest
    try {
        const enriched = await enrichEinsatzManifestChainEvidence(manifest, rpc)
        const manifest_hash = await computeEinsatzManifestHash(enriched)
        return { ...enriched, manifest_hash }
    } catch {
        return manifest
    }
}

export { manifestBodyForHash }
