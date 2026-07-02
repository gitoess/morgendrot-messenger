'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { resolveMainnetPackageId } from '@/frontend/lib/einsatz-mainnet-local-config'
import { looksLikeHttpRpcUrl } from '@/frontend/lib/einsatz-manifest-rpc'
import {
    applyBossWizardNetworkSetupPlan,
    networkProfilesUseSamePackageId,
    readNetworkProfilesState,
    syncProfilesFromApi,
    validateNetworkProfile,
    type EinsatzNetworkSetupPlan,
    type EinsatzNetworkProfilesState,
} from '@/frontend/lib/einsatz-network-profiles'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type NetworkSetupPlanOption = {
    id: EinsatzNetworkSetupPlan
    title: string
    subtitle: string
    detail: string
}

export const NETWORK_SETUP_PLAN_OPTIONS: NetworkSetupPlanOption[] = [
    {
        id: 'testnet-only',
        title: 'Nur Testnet (Übung)',
        subtitle: 'Kostenlos üben und schreiben',
        detail: 'Ideal zum Ausprobieren — keine echten Kosten. Verankerung auf Mainnet später in den Einstellungen möglich.',
    },
    {
        id: 'mainnet-only',
        title: 'Nur Mainnet (Produktion)',
        subtitle: 'Alles direkt auf der echten Chain',
        detail: 'Nachrichten landen von Anfang an auf Mainnet — Gas-Kosten und dauerhafte Verankerung.',
    },
    {
        id: 'both',
        title: 'Beides (empfohlen)',
        subtitle: 'Testnet zum Schreiben, Mainnet zum Verankern',
        detail: 'Du schickst meist kostenlos über Testnet und wechselst nur manchmal auf Mainnet, wenn es fest verankert werden soll.',
    },
]

export function readBossWizardNetworkSetupPlan(): EinsatzNetworkSetupPlan {
    const state = readNetworkProfilesState()
    return state.setupPlan ?? 'both'
}

export function isBossNetworkPlanStepChosen(): boolean {
    return readNetworkProfilesState().setupPlanChosen === true
}

/** Bestehende Server-/Profil-Config → Plan (Modus B Auto-Skip). */
export function inferNetworkSetupPlanFromProfiles(
    state = readNetworkProfilesState(),
    opts?: { hasPackageId?: boolean; apiStatus?: ApiStatus | null }
): EinsatzNetworkSetupPlan | null {
    if (state.setupPlanChosen && state.setupPlan) return state.setupPlan

    const opPkg = opts?.apiStatus?.packageId?.trim() ?? ''
    const testnetPkg =
        HEX64.test(state.testnet.packageId.trim()) || (opts?.hasPackageId && HEX64.test(opPkg))
    const mainnetPkg =
        HEX64.test(state.mainnet.packageId.trim()) &&
        !networkProfilesUseSamePackageId({
            ...state,
            testnet: {
                ...state.testnet,
                packageId: state.testnet.packageId.trim() || opPkg,
            },
        })

    if (testnetPkg && mainnetPkg) return 'both'
    const apiMainnet = getBossMainnetWizardStatus(opts?.apiStatus)
    if (testnetPkg && apiMainnet.anchorReady) return 'both'
    if (mainnetPkg && state.active === 'mainnet') return 'mainnet-only'
    if (testnetPkg || opts?.hasPackageId) return 'testnet-only'
    if (mainnetPkg) return 'mainnet-only'
    return null
}

export function ensureInferredBossNetworkSetupPlan(opts?: {
    hasPackageId?: boolean
    apiStatus?: ApiStatus | null
}): void {
    const state = readNetworkProfilesState()
    if (state.setupPlanChosen) return
    const inferred = inferNetworkSetupPlanFromProfiles(state, opts)
    if (!inferred) return
    applyBossWizardNetworkSetupPlan(inferred, state)
}

export function isBossChainStepSatisfied(opts?: {
    hasPackageId?: boolean
    apiStatus?: ApiStatus | null
}): boolean {
    const state = readNetworkProfilesState()
    const plan = state.setupPlan ?? inferNetworkSetupPlanFromProfiles(state, opts) ?? 'testnet-only'

    if (plan === 'testnet-only' || plan === 'both') {
        return Boolean(opts?.hasPackageId) || validateNetworkProfile(state.testnet).ok
    }

    const mainnetOk =
        validateNetworkProfile(state.mainnet).ok && !networkProfilesUseSamePackageId(state)
    return mainnetOk
}

export function syncBossWizardNetworkProfiles(apiStatus?: ApiStatus | null): EinsatzNetworkProfilesState {
    return syncProfilesFromApi(readNetworkProfilesState(), apiStatus)
}

export type BossMainnetWizardStatus = {
    packageId: string
    mailboxId: string
    /** Senden auf Mainnet (Package + Postfach + RPC). */
    sendReady: boolean
    /** Verankern / Registry (eigenes Package + RPC; Postfach optional). */
    anchorReady: boolean
    samePackageAsTestnet: boolean
}

export function getBossMainnetWizardStatus(apiStatus?: ApiStatus | null): BossMainnetWizardStatus {
    const state = syncBossWizardNetworkProfiles(apiStatus)
    const testnetPkg = (apiStatus?.packageId?.trim() || state.testnet.packageId.trim()).toLowerCase()

    let packageId = state.mainnet.packageId.trim()
    if (!HEX64.test(packageId)) {
        const resolved = resolveMainnetPackageId({
            chainMode: 'testnet-with-mainnet-anchor',
            fromApiStatus: apiStatus?.einsatzConfig?.mainnetPackageId,
            operationPackageId: apiStatus?.packageId,
        })
        if (HEX64.test(resolved)) packageId = resolved
    }

    const mailboxId = state.mainnet.mailboxId.trim()
    const rpcOk = looksLikeHttpRpcUrl(state.mainnet.rpcUrl)
    const samePackageAsTestnet = HEX64.test(packageId) && packageId.toLowerCase() === testnetPkg
    const anchorReady = HEX64.test(packageId) && rpcOk && !samePackageAsTestnet
    const sendReady = anchorReady && HEX64.test(mailboxId)

    return { packageId, mailboxId, sendReady, anchorReady, samePackageAsTestnet }
}

export function isBossMainnetProfileReady(
    state?: EinsatzNetworkProfilesState,
    apiStatus?: ApiStatus | null
): boolean {
    if (state && !apiStatus) {
        return validateNetworkProfile(state.mainnet).ok && !networkProfilesUseSamePackageId(state)
    }
    return getBossMainnetWizardStatus(apiStatus).sendReady
}
