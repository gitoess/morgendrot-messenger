'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import {
    DEFAULT_MAINNET_RPC_URL,
    DEFAULT_TESTNET_RPC_URL,
    type EinsatzChainMode,
} from '@morgendrot/shared/einsatz-chain-mode'
import { persistEinsatzChainMode } from '@/frontend/lib/einsatz-chain-mode-local'
import {
    getDirectChainFieldIdsFromLs,
    persistDirectMailboxChainSnapshot,
    setDirectChainFieldIdsFromNetworkProfile,
} from '@/frontend/lib/direct-iota-chain-context'
import { setBrowserDirectIotaRpcUrlOverride } from '@/frontend/lib/direct-iota-rpc'
import { clearOfflineMailboxQueue } from '@/frontend/lib/api/offline-queue'
import { setConfig } from '@/frontend/lib/api/dashboard-rest'
import { setPackageIdCommand } from '@/frontend/lib/api/package-connect'
import {
    setDirectChainOptimisticFlagsEnabled,
} from '@/frontend/lib/direct-iota-chain-context'
import {
    setDirectMailboxDrainEnabled,
    setIotaSubmitMode,
} from '@/frontend/lib/direct-iota-plain-submit'
import {
    writeBossMainnetPackageOverride,
} from '@/frontend/lib/einsatz-mainnet-local-config'
import { writeBossMainnetRpcOverride } from '@/frontend/lib/direct-iota-einsatz-manifest-anchor'
import { looksLikeHttpRpcUrl } from '@/frontend/lib/einsatz-manifest-rpc'

export type EinsatzNetworkId = 'testnet' | 'mainnet'

/** Wizard: welche Ketten eingerichtet werden — unabhängig vom aktiven Sende-Ziel. */
export type EinsatzNetworkSetupPlan = 'testnet-only' | 'mainnet-only' | 'both'

export type EinsatzNetworkProfileFields = {
    rpcUrl: string
    packageId: string
    mailboxId: string
}

export type EinsatzNetworkProfilesState = {
    active: EinsatzNetworkId
    /** Gewählter Einsatz (Wizard Schritt „Wo senden?“). */
    setupPlan?: EinsatzNetworkSetupPlan
    /** true nach expliziter Wizard-Wahl oder stiller Migration aus bestehender Config. */
    setupPlanChosen?: boolean
    testnet: EinsatzNetworkProfileFields
    mainnet: EinsatzNetworkProfileFields
}

export const EINSATZ_NETWORK_PROFILES_CHANGED = 'morgendrot:einsatz-network-profiles-changed'

const LS_KEY = 'morgendrot.einsatz.networkProfiles.v1'
const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export function defaultNetworkProfilesState(): EinsatzNetworkProfilesState {
    return {
        active: 'testnet',
        testnet: {
            rpcUrl: DEFAULT_TESTNET_RPC_URL,
            packageId: '',
            mailboxId: '',
        },
        mainnet: {
            rpcUrl: DEFAULT_MAINNET_RPC_URL,
            packageId: '',
            mailboxId: '',
        },
    }
}

export function chainModeForNetwork(id: EinsatzNetworkId): EinsatzChainMode {
    return id === 'mainnet' ? 'mainnet-direct' : 'testnet-with-mainnet-anchor'
}

export function networkLabel(id: EinsatzNetworkId): string {
    return id === 'mainnet' ? 'Mainnet' : 'Testnet'
}

export function notifyNetworkProfilesChanged(): void {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(EINSATZ_NETWORK_PROFILES_CHANGED))
}

export function readNetworkProfilesState(): EinsatzNetworkProfilesState {
    if (typeof window === 'undefined') return defaultNetworkProfilesState()
    try {
        const raw = window.localStorage.getItem(LS_KEY)
        if (!raw) return defaultNetworkProfilesState()
        const j = JSON.parse(raw) as Partial<EinsatzNetworkProfilesState>
        const base = defaultNetworkProfilesState()
        const pick = (id: EinsatzNetworkId): EinsatzNetworkProfileFields => ({
            rpcUrl: j[id]?.rpcUrl?.trim() || base[id].rpcUrl,
            packageId: j[id]?.packageId?.trim() || '',
            mailboxId: j[id]?.mailboxId?.trim() || '',
        })
        const active = j.active === 'mainnet' ? 'mainnet' : 'testnet'
        const setupPlan =
            j.setupPlan === 'mainnet-only' || j.setupPlan === 'both' || j.setupPlan === 'testnet-only'
                ? j.setupPlan
                : undefined
        return {
            active,
            setupPlan,
            setupPlanChosen: j.setupPlanChosen === true,
            testnet: pick('testnet'),
            mainnet: pick('mainnet'),
        }
    } catch {
        return defaultNetworkProfilesState()
    }
}

export function writeNetworkProfilesState(state: EinsatzNetworkProfilesState): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(state))
    } catch {
        /* ignore */
    }
    notifyNetworkProfilesChanged()
}

/** Füllt Betriebs-IDs aus Boss — nur für das **aktive** Netz (Testnet-Profil bleibt auf Mainnet erhalten). */
export function syncProfilesFromApi(
    state: EinsatzNetworkProfilesState,
    apiStatus?: ApiStatus | null
): EinsatzNetworkProfilesState {
    const out: EinsatzNetworkProfilesState = {
        active: state.active,
        testnet: { ...state.testnet },
        mainnet: { ...state.mainnet },
    }
    const cfg = apiStatus?.einsatzConfig
    const opPkg = apiStatus?.packageId?.trim() ?? ''
    const opMb = apiStatus?.mailboxId?.trim() ?? ''

    if (state.active === 'testnet') {
        if (HEX64.test(opPkg)) out.testnet.packageId = opPkg
        if (HEX64.test(opMb)) out.testnet.mailboxId = opMb
    } else {
        const testnetPkg = state.testnet.packageId.trim().toLowerCase()
        const testnetMb = state.testnet.mailboxId.trim().toLowerCase()
        if (HEX64.test(opPkg) && opPkg.toLowerCase() !== testnetPkg) {
            out.mainnet.packageId = opPkg
        }
        if (HEX64.test(opMb) && opMb.toLowerCase() !== testnetMb) {
            out.mainnet.mailboxId = opMb
        }
    }

    if (HEX64.test(cfg?.mainnetPackageId ?? '')) {
        out.mainnet.packageId = cfg!.mainnetPackageId!.trim()
    }
    if (looksLikeHttpRpcUrl(cfg?.mainnetRpcUrl)) {
        out.mainnet.rpcUrl = cfg!.mainnetRpcUrl!.trim()
    }

    return out
}

/** @deprecated Alias — nutzt syncProfilesFromApi */
export function mergeNetworkProfilesFromApi(
    state: EinsatzNetworkProfilesState,
    apiStatus?: ApiStatus | null
): EinsatzNetworkProfilesState {
    return syncProfilesFromApi(state, apiStatus)
}

export function summarizeNetworkState(state: EinsatzNetworkProfilesState): {
    activeOk: boolean
    line: string
    hint?: string
} {
    const v = validateNetworkProfile(state[state.active])
    if (v.ok) {
        return { activeOk: true, line: `${networkLabel(state.active)} — bereit zum Senden` }
    }
    if (state.active === 'mainnet') {
        if (networkProfilesUseSamePackageId(state)) {
            return {
                activeOk: false,
                line: 'Mainnet braucht eigenes Deploy',
                hint: 'Testnet-Package funktioniert nicht auf Mainnet. Move auf Mainnet deployen, Postfach anlegen, dann „Mainnet übernehmen“.',
            }
        }
        return {
            activeOk: false,
            line: `Mainnet unvollständig (${v.missing.join(', ')})`,
            hint: 'Unter „Mainnet einrichten“ IDs eintragen oder vom Boss übernehmen.',
        }
    }
    return {
        activeOk: false,
        line: `Testnet unvollständig (${v.missing.join(', ')})`,
        hint: 'Boss verbinden oder Handoff importieren.',
    }
}

export function applyMainnetMailboxFromServerMailbox(
    state: EinsatzNetworkProfilesState,
    serverMailboxId?: string
): EinsatzNetworkProfilesState {
    const mb = (serverMailboxId ?? '').trim()
    if (!HEX64.test(mb)) return state
    return {
        ...state,
        mainnet: { ...state.mainnet, mailboxId: mb },
    }
}

export function validateNetworkProfile(profile: EinsatzNetworkProfileFields): {
    ok: boolean
    missing: string[]
} {
    const missing: string[] = []
    if (!looksLikeHttpRpcUrl(profile.rpcUrl)) missing.push('RPC-URL')
    if (!HEX64.test(profile.packageId.trim())) missing.push('Package-ID')
    if (!HEX64.test(profile.mailboxId.trim())) missing.push('Mailbox-ID')
    return { ok: missing.length === 0, missing }
}

/** Testnet-Package auf Mainnet-RPC schlägt fehl — eigene Mainnet-Deploy-ID nötig. */
export function networkProfilesUseSamePackageId(state: EinsatzNetworkProfilesState): boolean {
    const a = state.testnet.packageId.trim().toLowerCase()
    const b = state.mainnet.packageId.trim().toLowerCase()
    return HEX64.test(a) && a === b
}

export function describeNetworkSwitchBlockReason(
    target: EinsatzNetworkId,
    state: EinsatzNetworkProfilesState
): string | null {
    if (target === 'mainnet' && networkProfilesUseSamePackageId(state)) {
        return 'Mainnet braucht eine eigene Package-ID (Move auf Mainnet deployen) — nicht dieselbe wie Testnet.'
    }
    const v = validateNetworkProfile(state[target])
    if (!v.ok) {
        return `${networkLabel(target)}-Profil unvollständig: ${v.missing.join(', ')}.`
    }
    return null
}

export function describeNetworkProfileReadiness(
    id: EinsatzNetworkId,
    profile: EinsatzNetworkProfileFields
): string {
    const v = validateNetworkProfile(profile)
    if (v.ok) return `${networkLabel(id)} bereit`
    return `${networkLabel(id)}: ${v.missing.join(', ')} fehlt`
}

export function readActiveNetworkProfile(): EinsatzNetworkProfileFields {
    const state = readNetworkProfilesState()
    return state[state.active]
}

/** Aktives Profil auf Boss + Puls + Kettenmodus anwenden. */
export async function applyActiveNetworkProfile(opts: {
    state: EinsatzNetworkProfilesState
    backendOnline?: boolean
    senderAddress?: string
    /** Warteschlange leeren (Netzwechsel — alte Package-IDs). Default: true. */
    clearOfflineQueue?: boolean
}): Promise<{ ok: true; queueCleared: number } | { ok: false; error: string }> {
    const profile = opts.state[opts.state.active]
    const validation = validateNetworkProfile(profile)
    if (!validation.ok) {
        return {
            ok: false,
            error: `${networkLabel(opts.state.active)}-Profil unvollständig (${validation.missing.join(', ')}).`,
        }
    }

    const sender =
        opts.senderAddress?.trim() ||
        getDirectChainFieldIdsFromLs().senderAddress ||
        undefined

    persistEinsatzChainMode(chainModeForNetwork(opts.state.active))
    setBrowserDirectIotaRpcUrlOverride(profile.rpcUrl)
    setDirectChainFieldIdsFromNetworkProfile({
        packageId: profile.packageId,
        mailboxId: profile.mailboxId,
        senderAddress: sender,
    })
    const flags = {
        useMailbox: true,
        mailboxStorePlaintext: true,
        messengerCreditsConfigured: false,
    }
    if (sender && HEX64.test(profile.packageId) && HEX64.test(profile.mailboxId)) {
        persistDirectMailboxChainSnapshot({
            packageId: profile.packageId.trim(),
            mailboxId: profile.mailboxId.trim(),
            senderAddress: sender.trim(),
            ttlDays: getDirectChainFieldIdsFromLs().ttlDays,
            flags,
        })
    }

    if (opts.state.active === 'mainnet') {
        setIotaSubmitMode('client')
        setDirectMailboxDrainEnabled(true)
        setDirectChainOptimisticFlagsEnabled(true)
    }

    writeBossMainnetRpcOverride(opts.state.mainnet.rpcUrl)
    writeBossMainnetPackageOverride(opts.state.mainnet.packageId)

    writeNetworkProfilesState(opts.state)

    let queueCleared = 0
    if (opts.clearOfflineQueue !== false) {
        queueCleared = clearOfflineMailboxQueue()
    }

    if (opts.backendOnline) {
        const rpcRes = await setConfig('RPC_URL', profile.rpcUrl.trim())
        if (!rpcRes.ok) {
            return { ok: false, error: rpcRes.error || 'RPC_URL (Boss) nicht gespeichert.' }
        }
        const pkgRes = await setPackageIdCommand(profile.packageId.trim())
        if (!pkgRes.ok) {
            return { ok: false, error: pkgRes.error || pkgRes.message || 'PACKAGE_ID (Boss) nicht gespeichert.' }
        }
        if (HEX64.test(profile.mailboxId.trim())) {
            await setConfig('MAILBOX_ID', profile.mailboxId.trim())
        }
        if (looksLikeHttpRpcUrl(opts.state.mainnet.rpcUrl)) {
            await setConfig('MAINNET_RPC_URL', opts.state.mainnet.rpcUrl.trim())
        }
        if (HEX64.test(opts.state.mainnet.packageId.trim())) {
            await setConfig('MAINNET_PACKAGE_ID', opts.state.mainnet.packageId.trim())
        }
    }

    return { ok: true, queueCleared }
}

export function applyBossWizardNetworkSetupPlan(
    plan: EinsatzNetworkSetupPlan,
    current?: EinsatzNetworkProfilesState
): EinsatzNetworkProfilesState {
    const state = current ?? readNetworkProfilesState()
    const active: EinsatzNetworkId = plan === 'mainnet-only' ? 'mainnet' : 'testnet'
    const next: EinsatzNetworkProfilesState = {
        ...state,
        active,
        setupPlan: plan,
        setupPlanChosen: true,
    }
    writeNetworkProfilesState(next)
    return next
}

export async function switchActiveNetwork(
    target: EinsatzNetworkId,
    opts: {
        backendOnline?: boolean
        senderAddress?: string
        apiStatus?: ApiStatus | null
    }
): Promise<{ ok: true; queueCleared: number } | { ok: false; error: string }> {
    const state = mergeNetworkProfilesFromApi(readNetworkProfilesState(), opts.apiStatus)
    if (state.active === target) {
        return applyActiveNetworkProfile({
            state,
            backendOnline: opts.backendOnline,
            senderAddress: opts.senderAddress,
        })
    }
    state.active = target
    const block = describeNetworkSwitchBlockReason(target, state)
    if (block) {
        return { ok: false, error: block }
    }
    return applyActiveNetworkProfile({
        state,
        backendOnline: opts.backendOnline,
        senderAddress: opts.senderAddress,
    })
}
