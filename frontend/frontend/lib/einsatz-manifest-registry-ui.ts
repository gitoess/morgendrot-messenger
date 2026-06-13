'use client'

import type { EinsatzChainMode } from '@morgendrot/shared/einsatz-chain-mode'
import {
    getDirectIotaSessionSigner,
    getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

/** Warum „Mainnet vorbereiten“ ausgegraut ist — `null` = Button aktiv. */
export function describeCreateEinsatzManifestRegistryBlockReason(opts: {
    registryObjectId?: string
    mainnetPackageId?: string
    chainMode: EinsatzChainMode
    packageId?: string
}): string | null {
    if (HEX64.test((opts.registryObjectId ?? '').trim())) return null

    if (!getDirectIotaSessionSigner() || !getDirectIotaSessionSignerAddress()) {
        return 'Puls wallet: Settings → System & Identity → "Mailbox · Direct RPC · Streams Pulse" → session signer (mnemonic). Same wallet for testnet and mainnet — mainnet transactions require IOTA gas on mainnet.'
    }

    const pkg =
        opts.mainnetPackageId?.trim() ||
        (opts.chainMode === 'testnet-with-mainnet-anchor' ? '' : opts.packageId?.trim() ?? '')

    if (!HEX64.test(pkg)) {
        if (opts.chainMode === 'testnet-with-mainnet-anchor') {
            return 'Mainnet package missing — Settings → Network → fill in mainnet profile.'
        }
        return 'Package ID missing — import handoff.'
    }

    return null
}
