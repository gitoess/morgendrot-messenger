'use client'

import { createDirectIotaClient, type IotaClient } from '@morgendrot/core/iota'
import type { EinsatzManifestEntryV1, EinsatzManifestV1 } from '@/frontend/lib/einsatz-manifest-v1'
import { inferEinsatzManifestEvidenceStatus } from '@/frontend/lib/einsatz-manifest-v1'

export { inferEinsatzManifestEvidenceStatus }

function extractTxTimestampMs(res: unknown): number | undefined {
    const raw = (res as { timestampMs?: number | string | bigint }).timestampMs
    if (raw == null) return undefined
    const n = typeof raw === 'bigint' ? Number(raw) : Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

export async function fetchSourceTxTimestampMs(client: IotaClient, digest: string): Promise<number | undefined> {
    const d = digest.trim()
    if (!d) return undefined
    try {
        const res = await client.getTransactionBlock({
            digest: d,
            options: { showEffects: true },
        } as Parameters<IotaClient['getTransactionBlock']>[0])
        return extractTxTimestampMs(res)
    } catch {
        return undefined
    }
}

/** RPC: Testnet/Mainnet-Zeitstempel pro `source_tx_digest` (Explorer-Beweis). */
export async function enrichEinsatzManifestChainEvidence(
    manifest: EinsatzManifestV1,
    rpcUrl: string
): Promise<EinsatzManifestV1> {
    const rpc = rpcUrl?.trim() ?? ''
    const client = rpc ? createDirectIotaClient({ rpcUrl: rpc }) : null
    const entries: EinsatzManifestEntryV1[] = []
    for (const e of manifest.entries) {
        const digest = e.source_tx_digest?.trim()
        let source_tx_timestamp_ms = e.source_tx_timestamp_ms
        if (client && digest && source_tx_timestamp_ms == null) {
            source_tx_timestamp_ms = await fetchSourceTxTimestampMs(client, digest)
        }
        entries.push({
            ...e,
            evidence_status: e.evidence_status ?? inferEinsatzManifestEvidenceStatus(e),
            ...(source_tx_timestamp_ms != null ? { source_tx_timestamp_ms } : {}),
        })
    }
    return { ...manifest, entries }
}
