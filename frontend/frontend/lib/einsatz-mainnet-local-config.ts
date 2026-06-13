'use client'

import { readBossMainnetRpcOverride } from '@/frontend/lib/direct-iota-einsatz-manifest-anchor'
import type { EinsatzChainMode } from '@morgendrot/shared/einsatz-chain-mode'

import { readNetworkProfilesState } from '@/frontend/lib/einsatz-network-profiles'

const LS_MAINNET_PKG = 'morgendrot.boss.mainnetPackageId.v1'
const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export function readBossMainnetPackageOverride(): string {
    if (typeof window === 'undefined') return ''
    try {
        return window.localStorage.getItem(LS_MAINNET_PKG)?.trim() ?? ''
    } catch {
        return ''
    }
}

export function writeBossMainnetPackageOverride(id: string): void {
    if (typeof window === 'undefined') return
    try {
        const v = id.trim()
        if (v) window.localStorage.setItem(LS_MAINNET_PKG, v)
        else window.localStorage.removeItem(LS_MAINNET_PKG)
    } catch {
        /* ignore */
    }
}

/** Mainnet-Package: lokales Override → Boss-Status → (nur Mainnet-Modus) Betriebs-Package. */
export function resolveMainnetPackageId(opts: {
    chainMode: EinsatzChainMode
    fromApiStatus?: string
    operationPackageId?: string
}): string {
    const fromProfiles = readNetworkProfilesState().mainnet.packageId.trim()
    if (HEX64.test(fromProfiles)) return fromProfiles
    const local = readBossMainnetPackageOverride()
    if (HEX64.test(local)) return local
    const fromApi = (opts.fromApiStatus ?? '').trim()
    if (HEX64.test(fromApi)) return fromApi
    if (opts.chainMode === 'testnet-with-mainnet-anchor') return ''
    const op = (opts.operationPackageId ?? '').trim()
    return HEX64.test(op) ? op : ''
}

export function resolveMainnetRpcUrlForUi(opts: { fromApiStatus?: string }): string {
    const local = readBossMainnetRpcOverride()
    if (local.startsWith('http://') || local.startsWith('https://')) return local
    const fromApi = (opts.fromApiStatus ?? '').trim()
    if (fromApi.startsWith('http://') || fromApi.startsWith('https://')) return fromApi
    return ''
}
