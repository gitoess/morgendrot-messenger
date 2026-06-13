/**
 * § H.33 — Einsatz-Kettenmodus (Handoff / Betrieb).
 */
export const EINSATZ_CHAIN_MODES = [
    'mainnet-direct',
    'testnet-with-mainnet-anchor',
    'mainnet-direct-no-rollup',
] as const

export type EinsatzChainMode = (typeof EINSATZ_CHAIN_MODES)[number]

export const EINSATZ_CHAIN_MODE_ENV_KEY = 'EINSATZ_CHAIN_MODE'
export const MAINNET_RPC_URL_ENV_KEY = 'MAINNET_RPC_URL'

export const DEFAULT_MAINNET_RPC_URL = 'https://api.mainnet.iota.cafe'
export const DEFAULT_TESTNET_RPC_URL = 'https://api.testnet.iota.cafe'

export function parseEinsatzChainMode(raw: string | undefined | null): EinsatzChainMode {
    const v = (raw ?? '').trim().toLowerCase()
    if ((EINSATZ_CHAIN_MODES as readonly string[]).includes(v)) return v as EinsatzChainMode
    return 'mainnet-direct'
}

export function einsatzChainModeShowsManifestAnchorUi(mode: EinsatzChainMode): boolean {
    return mode !== 'mainnet-direct-no-rollup'
}

export function einsatzChainModeSourceNetwork(mode: EinsatzChainMode, rpcUrl: string): 'testnet' | 'mainnet' {
    if (mode === 'testnet-with-mainnet-anchor') return 'testnet'
    const host = rpcUrl.trim().toLowerCase()
    if (host.includes('testnet')) return 'testnet'
    return 'mainnet'
}

export function defaultHandoffRpcForChainMode(mode: EinsatzChainMode): string {
    return mode === 'testnet-with-mainnet-anchor' ? DEFAULT_TESTNET_RPC_URL : DEFAULT_MAINNET_RPC_URL
}

export type EinsatzChainModeBanner = {
    tone: 'mainnet' | 'testnet' | 'neutral'
    title: string
    detail: string
}

export function describeEinsatzChainModeBanner(
    mode: EinsatzChainMode,
    rpcUrl?: string
): EinsatzChainModeBanner {
    const rpc = (rpcUrl ?? '').trim()
    switch (mode) {
        case 'testnet-with-mainnet-anchor':
            return {
                tone: 'testnet',
                title: 'Testnet — Betrieb',
                detail:
                    'Nachrichten landen auf Testnet. Mainnet-Anker am Einsatz-Ende empfohlen (Boss).' +
                    (rpc ? ` RPC: ${rpc}` : ''),
            }
        case 'mainnet-direct-no-rollup':
            return {
                tone: 'mainnet',
                title: 'Mainnet direkt (ohne Rollup)',
                detail:
                    'Einzel-TXs + optional Mainnet-Batch-Archiv (§ H.33e) — kein Manifest-Rollup nötig.' +
                    (rpc ? ` RPC: ${rpc}` : ''),
            }
        default:
            return {
                tone: 'mainnet',
                title: 'Mainnet / Dienst',
                detail:
                    'Betrieb on-chain auf Mainnet. Optional: Einsatz-Protokoll verankern (Rollup).' +
                    (rpc ? ` RPC: ${rpc}` : ''),
            }
    }
}

export const EINSATZ_CHAIN_MODE_LABELS: Record<EinsatzChainMode, string> = {
    'mainnet-direct': 'Mainnet direkt (Produktion)',
    'testnet-with-mainnet-anchor': 'Testnet + Mainnet-Anker',
    'mainnet-direct-no-rollup': 'Mainnet direkt, ohne Rollup',
}
