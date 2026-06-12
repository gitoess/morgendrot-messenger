'use client'

import {
    createDirectIotaClient,
    fetchEinsatzManifestAnchorsForEinsatz,
    type EinsatzManifestAnchorRow,
} from '@morgendrot/core/iota'
import type { ApiStatus } from '@/frontend/lib/api'
import { resolveEinsatzIdFromHandoff } from '@/frontend/lib/einsatz-manifest-anchor-flow'
import { einsatzIdUtf8ToMoveAddress } from '@/frontend/lib/einsatz-manifest-v1'
import { resolveEinsatzManifestAnchorRpcUrl } from '@/frontend/lib/direct-iota-einsatz-manifest-anchor'
import { fetchEinsatzManifestAnchorsFromApi } from '@/frontend/lib/api/einsatz-manifest-api'

export type ListEinsatzManifestAnchorsResult =
    | { ok: true; rows: EinsatzManifestAnchorRow[] }
    | { ok: false; error: string }

/** § H.33 — Mainnet-Anker unter der Registry für aktuellen Einsatz auflisten. */
export async function listEinsatzManifestAnchorsOnMainnet(opts: {
    apiStatus?: ApiStatus | null
    einsatzId?: string
}): Promise<ListEinsatzManifestAnchorsResult> {
    const api = await fetchEinsatzManifestAnchorsFromApi({ einsatzId: opts.einsatzId })
    if (api.ok) return { ok: true, rows: api.rows }
    if (api.httpStatus != null && api.httpStatus !== 403) {
        return { ok: false, error: api.error }
    }

    const cfg = opts.apiStatus?.einsatzConfig
    const registryId = cfg?.einsatzManifestRegistryId?.trim() ?? ''
    const mainnetPkg =
        cfg?.mainnetPackageId?.trim() || opts.apiStatus?.packageId?.trim() || ''
    if (!/^0x[a-fA-F0-9]{64}$/i.test(registryId)) {
        return { ok: false, error: 'EINSATZ_MANIFEST_REGISTRY_ID fehlt — zuerst Mainnet-Registry anlegen.' }
    }
    if (!mainnetPkg) {
        return { ok: false, error: 'MAINNET_PACKAGE_ID bzw. Package-ID fehlt.' }
    }
    const rpc = resolveEinsatzManifestAnchorRpcUrl({
        mainnetRpcFromStatus: cfg?.mainnetRpcUrl,
        operationRpcHint: opts.apiStatus?.rpcUrlLabel,
    })
    if (!rpc) {
        return { ok: false, error: 'Keine Mainnet-RPC-URL für Anker-Liste.' }
    }
    const einsatzUtf8 = opts.einsatzId?.trim() || resolveEinsatzIdFromHandoff(opts.apiStatus)
    const einsatzMove = await einsatzIdUtf8ToMoveAddress(einsatzUtf8)
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const rows = await fetchEinsatzManifestAnchorsForEinsatz(client, {
        packageId: mainnetPkg,
        registryObjectId: registryId,
        einsatzIdMoveAddress: einsatzMove,
    })
    return { ok: true, rows }
}
