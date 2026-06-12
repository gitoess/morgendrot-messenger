'use client'

import {
    einsatzChainModeSourceNetwork,
    type EinsatzChainMode,
} from '@morgendrot/shared/einsatz-chain-mode'

const DEFAULT_EXPLORER_BASE = 'https://explorer.iota.org/txblock'

function explorerBaseUrl(): string {
    const fromEnv =
        typeof process !== 'undefined' &&
        typeof process.env?.NEXT_PUBLIC_IOTA_TX_EXPLORER_BASE === 'string' &&
        process.env.NEXT_PUBLIC_IOTA_TX_EXPLORER_BASE.trim()
    return (fromEnv || DEFAULT_EXPLORER_BASE).replace(/\/$/, '')
}

export function explorerNetworkQueryForChain(
    chainMode: EinsatzChainMode,
    rpcHint?: string
): string {
    const net = einsatzChainModeSourceNetwork(chainMode, rpcHint ?? '')
    return net === 'testnet' ? '?network=testnet' : net === 'mainnet' ? '?network=mainnet' : ''
}

/** Explorer-Link für Betriebs-TXs (Testnet in Modus A, Mainnet in B/C). */
export function explorerTxUrlForEinsatzChain(
    digest: string,
    chainMode: EinsatzChainMode,
    rpcHint?: string
): string {
    const d = digest.trim()
    if (!d) return ''
    return `${explorerBaseUrl()}/${encodeURIComponent(d)}${explorerNetworkQueryForChain(chainMode, rpcHint)}`
}

/** Explorer-Link für Mainnet-Anker-TX (immer Mainnet). */
export function explorerTxUrlForMainnetAnchor(digest: string): string {
    const d = digest.trim()
    if (!d) return ''
    return `${explorerBaseUrl()}/${encodeURIComponent(d)}?network=mainnet`
}

export function shortTxDigestLabel(digest: string): string {
    const d = digest.trim()
    if (!d) return ''
    return d.length > 14 ? `${d.slice(0, 12)}…` : d
}
