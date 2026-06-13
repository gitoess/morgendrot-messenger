'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import {
    DEFAULT_MAINNET_RPC_URL,
    DEFAULT_TESTNET_RPC_URL,
    type EinsatzChainMode,
} from '@morgendrot/shared/einsatz-chain-mode'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'

/** Nur echte http(s)-URLs — keine Labels wie „Testnet“ oder „Mainnet“. */
export function looksLikeHttpRpcUrl(raw: string | undefined | null): boolean {
    const t = raw?.trim()
    if (!t) return false
    try {
        const u = new URL(t)
        return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
        return false
    }
}

/**
 * RPC für optionale Chain-Zeitstempel beim Manifest-Bau (Quell-Netz, nicht Mainnet-Anker).
 * `rpcUrlLabel` / `network` aus Status sind Anzeige-Labels — nie als URL verwenden.
 */
export function resolveManifestEnrichmentRpcUrl(opts: {
    chainMode: EinsatzChainMode
    apiStatus?: ApiStatus | null
}): string | undefined {
    const configured = getConfiguredDirectIotaRpcUrl()
    if (looksLikeHttpRpcUrl(configured)) return configured!.trim()

    if (opts.chainMode === 'testnet-with-mainnet-anchor') {
        return DEFAULT_TESTNET_RPC_URL
    }

    const mainnetFromBoss = opts.apiStatus?.einsatzConfig?.mainnetRpcUrl
    if (looksLikeHttpRpcUrl(mainnetFromBoss)) return mainnetFromBoss!.trim()

    if (opts.chainMode === 'mainnet-direct') {
        return DEFAULT_MAINNET_RPC_URL
    }

    return undefined
}
