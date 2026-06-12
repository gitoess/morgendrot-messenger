'use client'

import {
    createDirectIotaClient,
    probeEinsatzManifestAnchorOnChain,
} from '@morgendrot/core/iota'
import type { ApiStatus } from '@/frontend/lib/api'
import { resolveEinsatzIdFromHandoff } from '@/frontend/lib/einsatz-manifest-anchor-flow'
import { einsatzIdUtf8ToMoveAddress } from '@/frontend/lib/einsatz-manifest-v1'
import { resolveEinsatzManifestAnchorRpcUrl } from '@/frontend/lib/direct-iota-einsatz-manifest-anchor'
import { probeEinsatzManifestSequenceFromApi } from '@/frontend/lib/api/einsatz-manifest-api'
export type ProbeEinsatzManifestOnChainResult =
    | { ok: true; exists: boolean; sequence: number }
    | { ok: false; error: string }

/** § H.33 — RPC-Probe: existiert Sequenz N unter der Registry? */
export async function probeEinsatzManifestSequenceOnChain(opts: {
    apiStatus?: ApiStatus | null
    sequence: number
    einsatzId?: string
}): Promise<ProbeEinsatzManifestOnChainResult> {
    const api = await probeEinsatzManifestSequenceFromApi({
        sequence: opts.sequence,
        einsatzId: opts.einsatzId,
    })
    if (api.ok) return { ok: true, exists: api.exists, sequence: api.sequence }
    if (api.httpStatus != null && api.httpStatus !== 403) {
        return { ok: false, error: api.error }
    }

    const cfg = opts.apiStatus?.einsatzConfig
    const registryId = cfg?.einsatzManifestRegistryId?.trim() ?? ''
    const mainnetPkg =
        cfg?.mainnetPackageId?.trim() || opts.apiStatus?.packageId?.trim() || ''
    if (!/^0x[a-fA-F0-9]{64}$/i.test(registryId)) {
        return { ok: false, error: 'EINSATZ_MANIFEST_REGISTRY_ID fehlt oder ungültig.' }
    }
    if (!mainnetPkg) {
        return { ok: false, error: 'Package-ID für Mainnet-Probe fehlt.' }
    }
    const rpc = resolveEinsatzManifestAnchorRpcUrl({
        mainnetRpcFromStatus: cfg?.mainnetRpcUrl,
        operationRpcHint: opts.apiStatus?.rpcUrlLabel,
    })
    if (!rpc) {
        return { ok: false, error: 'Keine Mainnet-RPC-URL für die Probe.' }
    }
    const einsatzUtf8 = opts.einsatzId?.trim() || resolveEinsatzIdFromHandoff(opts.apiStatus)
    const einsatzMove = await einsatzIdUtf8ToMoveAddress(einsatzUtf8)
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const exists = await probeEinsatzManifestAnchorOnChain(client, {
        packageId: mainnetPkg,
        registryObjectId: registryId,
        einsatzIdMoveAddress: einsatzMove,
        sequence: BigInt(Math.max(0, opts.sequence)),
    })
    return { ok: true, exists, sequence: opts.sequence }
}
