'use client'

import {
    readNetworkProfilesState,
    validateNetworkProfile,
    type EinsatzNetworkId,
} from '@/frontend/lib/einsatz-network-profiles'
import {
    getDirectChainFieldIdsFromLs,
    persistDirectMailboxChainSnapshot,
    setDirectChainFieldIdsFromNetworkProfile,
    applyDirectMailboxChainSnapshotFromNetworkIds,
} from '@/frontend/lib/direct-iota-chain-context'
import { setBrowserDirectIotaRpcUrlOverride, getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { clearOfflineMailboxQueue, loadOfflineMailboxQueue, purgeInsecureEncryptedQueueItems } from '@/frontend/lib/api/offline-queue'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import {
    canTryLivePlaintextDirectMailbox,
    listDirectIotaSetupGaps,
} from '@/frontend/lib/direct-iota-plain-submit'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

/** Ketten-Snapshot + RPC aus aktivem Netzwerk-Profil (Testnet/Mainnet-Schalter). */
export function syncActiveNetworkChainSnapshot(senderAddress?: string): {
    ok: boolean
    network: EinsatzNetworkId
    missing?: string[]
} {
    const state = readNetworkProfilesState()
    const profile = state[state.active]
    const validation = validateNetworkProfile(profile)
    if (!validation.ok) {
        return { ok: false, network: state.active, missing: validation.missing }
    }

    setBrowserDirectIotaRpcUrlOverride(profile.rpcUrl)
    const sender =
        senderAddress?.trim() ||
        getDirectChainFieldIdsFromLs().senderAddress.trim() ||
        ''
    setDirectChainFieldIdsFromNetworkProfile({
        packageId: profile.packageId,
        mailboxId: profile.mailboxId,
        senderAddress: sender,
    })
    if (state.active === 'mainnet') {
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('morgendrot.directMailboxDrain', '1')
                window.localStorage.setItem('morgendrot.directChain.optimisticFlags', '1')
                window.localStorage.removeItem('morgendrot.iotaSubmitMode')
            }
        } catch {
            /* ignore */
        }
    }
    if (HEX64.test(sender)) {
        persistDirectMailboxChainSnapshot({
            packageId: profile.packageId.trim(),
            mailboxId: profile.mailboxId.trim(),
            senderAddress: sender,
            ttlDays: getDirectChainFieldIdsFromLs().ttlDays,
            flags: {
                useMailbox: true,
                mailboxStorePlaintext: true,
                messengerCreditsConfigured: false,
            },
        })
    }
    return { ok: true, network: state.active }
}

export type ApiStatusChainIds = {
    packageId?: string | null
    mailboxId?: string | null
    myAddress?: string | null
    myAddressFull?: string | null
}

/**
 * Ketten-Snapshot aus aktivem Netzwerk-Profil (Mainnet/Testnet-Schalter) — nicht blind aus Boss `/api/status`.
 * Boss `PACKAGE_ID` ist oft Testnet; auf Mainnet würde das den Direkt-Send kaputt machen.
 */
export function applyDirectChainSnapshotFromStatusOrNetworkProfile(status: ApiStatusChainIds): boolean {
    const sender =
        status.myAddressFull?.trim() ||
        status.myAddress?.trim() ||
        getDirectChainFieldIdsFromLs().senderAddress.trim() ||
        ''

    const state = readNetworkProfilesState()
    const profile = state[state.active]
    if (validateNetworkProfile(profile).ok) {
        syncActiveNetworkChainSnapshot(sender || undefined)
        return true
    }

    if (state.active !== 'testnet') return false

    const pkg = status.packageId?.trim() ?? ''
    const mb = status.mailboxId?.trim() ?? ''
    if (!HEX64.test(pkg) || !HEX64.test(mb) || !HEX64.test(sender)) return false
    applyDirectMailboxChainSnapshotFromNetworkIds({
        packageId: pkg,
        mailboxId: mb,
        myAddress: sender,
    })
    return true
}

/** Package/Mailbox in localStorage an aktives Netzwerk-Profil angleichen (Boss-Testnet darf Mainnet nicht überschreiben). */
export function ensureDirectChainAlignedWithActiveProfile(): boolean {
    const state = readNetworkProfilesState()
    const profile = state[state.active]
    if (!validateNetworkProfile(profile).ok) return false

    const ls = getDirectChainFieldIdsFromLs()
    const profilePkg = profile.packageId.trim().toLowerCase()
    const profileMb = profile.mailboxId.trim().toLowerCase()
    const lsPkg = ls.packageId.trim().toLowerCase()
    const lsMb = ls.mailboxId.trim().toLowerCase()
    const rpc = (getConfiguredDirectIotaRpcUrl() || '').trim().toLowerCase()
    const profileRpc = profile.rpcUrl.trim().toLowerCase()

    const pkgMismatch = lsPkg !== profilePkg
    const mbMismatch = lsMb !== profileMb
    const rpcMismatch = rpc !== profileRpc && profileRpc.length > 0

    if (!pkgMismatch && !mbMismatch && !rpcMismatch) return true

    syncActiveNetworkChainSnapshot(ls.senderAddress || undefined)
    return true
}

/** Queue-Einträge mit falscher Package-ID (Netzwechsel / Testnet-Rest auf Mainnet). */
export function purgeStaleOfflineMailboxQueue(): number {
    const legacyPurged = purgeInsecureEncryptedQueueItems()
    if (loadOfflineMailboxQueue().length === 0) return legacyPurged

    const state = readNetworkProfilesState()
    const profile = state[state.active]
    if (!HEX64.test(profile.packageId)) return legacyPurged

    const snapPkg = getDirectChainFieldIdsFromLs().packageId.trim().toLowerCase()
    const profilePkg = profile.packageId.trim().toLowerCase()
    const testnetPkg = state.testnet.packageId.trim().toLowerCase()

    let purge = false
    if (snapPkg && snapPkg !== profilePkg) purge = true
    if (state.active === 'mainnet' && snapPkg === testnetPkg && testnetPkg !== profilePkg) purge = true
    if (state.active === 'mainnet' && profilePkg === testnetPkg) purge = true
    const rpc = (getConfiguredDirectIotaRpcUrl() || '').toLowerCase()
    if (rpc.includes('mainnet') && HEX64.test(testnetPkg) && snapPkg === testnetPkg) purge = true

    return purge ? legacyPurged + clearOfflineMailboxQueue() : legacyPurged
}

/** Testnet-Package auf Mainnet-RPC (oder umgekehrt) — zwei typische Fullnode-Meldungen. */
export function isWrongNetworkPackageError(message: string): boolean {
    const m = message.trim().toLowerCase()
    return m.includes('package object does not exist') || m.includes('dependent package not found')
}

export function isPackageNotFoundOnChainError(message: string): boolean {
    return isWrongNetworkPackageError(message)
}

/** Mainnet: Boss-Relay deaktiviert — Direkt-Pfad fehlt noch (kein sinnvolles Queue-Enqueue). */
export function isMainnetDirectSendBlockedError(message: string): boolean {
    const m = message.trim().toLowerCase()
    return (
        m.includes('boss-/api nutzt sonst testnet-package_id') ||
        m.includes('produktion (mainnet): direkt-rpc') ||
        m.includes('produktion (mainnet): nur direkt-rpc') ||
        m.includes('mainnet: team-broadcast nur per direkt-rpc') ||
        m.includes('produktion (mainnet): verschlüsselter direkt-send')
    )
}

/** Konkrete fehlende Schritte für Mainnet-Direkt-Send (Drain, Signer, IDs). */
export function formatMainnetDirectSendBlockedMessage(): string {
    const state = readNetworkProfilesState()
    if (state.active !== 'mainnet' || !validateNetworkProfile(state.mainnet).ok) {
        return 'Produktion (Mainnet): Profil unvollständig — Einstellungen → Netzwerk prüfen.'
    }
    syncActiveNetworkChainSnapshot()
    if (canTryLivePlaintextDirectMailbox()) {
        return 'Mainnet-Direkt-Send sollte bereit sein — bitte erneut senden.'
    }
    const gaps = listDirectIotaSetupGaps()
    let tail = gaps.length > 0 ? ` Fehlt: ${gaps.join(' · ')}.` : ''
    if (gaps.some((g) => /session-signer/i.test(g))) {
        tail += ' Startseite: Tresor entsperren (Signer wird automatisch geladen).'
    }
    return `Produktion (Mainnet): nur Direkt-RPC (Boss-/api nutzt Testnet-PACKAGE_ID).${tail}`
}

export function recoverMainnetDirectSendBlockedFailure(senderAddress?: string): {
    cleared: number
    userMessage: string
} {
    syncActiveNetworkChainSnapshot(senderAddress)
    const cleared = clearOfflineMailboxQueue()
    let userMessage = formatMainnetDirectSendBlockedMessage()
    if (cleared > 0) {
        userMessage += ` ${cleared} Warteschlangen-Einträge entfernt — danach neue Nachricht senden.`
    }
    return { cleared, userMessage }
}

/** Ketten-IDs synchronisieren, Queue leeren, nutzerlesbare Meldung für Send-Fehler. */
export function recoverWrongNetworkPackageSendFailure(
    errText: string,
    senderAddress?: string
): { cleared: number; userMessage: string } {
    syncActiveNetworkChainSnapshot(senderAddress)
    const cleared = clearOfflineMailboxQueue()
    let userMessage = formatDirectIotaSubmitError(errText)
    if (cleared > 0) {
        userMessage += ` ${cleared} Einträge aus der Warteschlange entfernt (falsche Package-ID).`
    }
    return { cleared, userMessage }
}
