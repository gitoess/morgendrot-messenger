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
        return 'Puls-Wallet: Einstellungen → System & Identität → „Mailbox · Direkt-RPC · Streams-Puls“ → Session-Signer (Mnemonic). Dieselbe Wallet für Testnet und Mainnet — für Mainnet-TX brauchst du IOTA-Gas auf Mainnet.'
    }

    const pkg =
        opts.mainnetPackageId?.trim() ||
        (opts.chainMode === 'testnet-with-mainnet-anchor' ? '' : opts.packageId?.trim() ?? '')

    if (!HEX64.test(pkg)) {
        if (opts.chainMode === 'testnet-with-mainnet-anchor') {
            return 'Mainnet-Package fehlt — Einstellungen → Netzwerk → Mainnet-Profil ausfüllen.'
        }
        return 'Package-ID fehlt — Handoff importieren.'
    }

    return null
}
