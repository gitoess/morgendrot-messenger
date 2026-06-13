'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import type { EinsatzChainMode } from '@morgendrot/shared/einsatz-chain-mode'
import { fetchInboxFromAllOwnedMailboxes } from '@/frontend/lib/inbox-multi-mailbox-fetch'
import {
    readEinsatzManifestLastAnchoredSequence,
    writeEinsatzManifestLastAnchoredSequence,
} from '@/frontend/lib/einsatz-chain-mode-local'
import {
    buildEinsatzManifestV1,
    downloadEinsatzManifestJson,
    type EinsatzManifestV1,
} from '@/frontend/lib/einsatz-manifest-v1'
import { finalizeEinsatzManifestWithChainEvidence } from '@/frontend/lib/einsatz-manifest-finalize'
import { resolveInboxMessageTxDigest } from '@/frontend/lib/einsatz-message-tx-digest'
import { enrichInboxMessagesWithChainDigests } from '@/frontend/lib/enrich-inbox-messages-chain-digest'
import { resolveManifestEnrichmentRpcUrl } from '@/frontend/lib/einsatz-manifest-rpc'
import { writeAnchoredManifestFromV1 } from '@/frontend/lib/einsatz-manifest-anchor-cache'
import {
    tryAnchorEinsatzManifestViaDirectIota,
    writeBossMainnetRpcOverride,
} from '@/frontend/lib/direct-iota-einsatz-manifest-anchor'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import type { Message } from '@/frontend/lib/types'

export type BuildEinsatzManifestFlowResult =
    | { ok: true; manifest: EinsatzManifestV1 }
    | { ok: false; error: string }

export type RunEinsatzManifestAnchorFlowResult =
    | { ok: true; manifest: EinsatzManifestV1; digest?: string; downloaded: boolean; anchored: boolean }
    | { ok: false; error: string }

export function resolveEinsatzIdFromHandoff(apiStatus?: ApiStatus | null): string {
    const snap = readLocalHandoffAppliedSnapshot()
    const label = snap?.handoffLabel?.trim() || 'einsatz'
    const pkg = (snap?.packageId || apiStatus?.packageId || 'local').trim()
    return `${label}-${pkg.slice(0, 10)}`
}

/** § H.33c — Manifest aus Posteingang inkl. source_tx_digest (wenn lokal bekannt). */
export async function buildEinsatzManifestFromInbox(opts: {
    apiStatus?: ApiStatus | null
    chainMode: EinsatzChainMode
    rpcHint?: string
}): Promise<BuildEinsatzManifestFlowResult> {
    const inbox = await fetchInboxFromAllOwnedMailboxes({
        limit: 500,
        offset: 0,
        includePrivateMailboxes: true,
    })
    if (!inbox.ok) {
        return { ok: false, error: inbox.error || 'Posteingang nicht geladen.' }
    }
    const pkg = (opts.apiStatus?.packageId || readLocalHandoffAppliedSnapshot()?.packageId || '').trim()
    if (!pkg) {
        return { ok: false, error: 'PACKAGE_ID fehlt — Handoff importieren oder Basis verbinden.' }
    }
    const lastSeq = readEinsatzManifestLastAnchoredSequence()
    const messages = enrichInboxMessagesWithChainDigests(inbox.messages)
    const rpcUrl = resolveManifestEnrichmentRpcUrl({
        chainMode: opts.chainMode,
        apiStatus: opts.apiStatus,
    })
    const manifestBuilt = await buildEinsatzManifestV1({
        einsatzId: resolveEinsatzIdFromHandoff(opts.apiStatus),
        handoffLabel: readLocalHandoffAppliedSnapshot()?.handoffLabel,
        packageId: pkg,
        chainMode: opts.chainMode,
        rpcUrl,
        messages,
        sequence: lastSeq + 1,
        resolveTxDigest: (m: Message) => resolveInboxMessageTxDigest(m),
    })
    const manifest = await finalizeEinsatzManifestWithChainEvidence(manifestBuilt, rpcUrl)
    return { ok: true, manifest }
}

export async function runEinsatzManifestAnchorFlow(opts: {
    apiStatus?: ApiStatus | null
    chainMode: EinsatzChainMode
    rpcHint?: string
    downloadJson?: boolean
    anchorOnChain?: boolean
}): Promise<RunEinsatzManifestAnchorFlowResult> {
    const built = await buildEinsatzManifestFromInbox(opts)
    if (!built.ok) return built

    const manifest = built.manifest
    let downloaded = false
    let anchored = false
    let digest: string | undefined

    if (opts.downloadJson !== false) {
        downloadEinsatzManifestJson(manifest)
        downloaded = true
    }
    writeEinsatzManifestLastAnchoredSequence(manifest.sequence)
    writeAnchoredManifestFromV1(manifest)

    if (opts.anchorOnChain) {
        const einsatzCfg = opts.apiStatus?.einsatzConfig
        const registryId = einsatzCfg?.einsatzManifestRegistryId ?? ''
        const mainnetRpcFromStatus = einsatzCfg?.mainnetRpcUrl ?? ''
        const mainnetPackageId =
            einsatzCfg?.mainnetPackageId?.trim() ||
            (opts.chainMode === 'testnet-with-mainnet-anchor'
                ? ''
                : manifest.source_package_id.trim())
        if (!mainnetPackageId) {
            return { ok: false, error: 'MAINNET_PACKAGE_ID fehlt (Modus A) — Boss-.env setzen.' }
        }
        if (mainnetRpcFromStatus) writeBossMainnetRpcOverride(mainnetRpcFromStatus)
        const out = await tryAnchorEinsatzManifestViaDirectIota({
            manifest,
            registryObjectId: registryId,
            mainnetPackageId,
            mainnetRpcFromStatus,
        })
        if (!out.ok) return { ok: false, error: out.error }
        anchored = true
        digest = out.digest
        writeAnchoredManifestFromV1(manifest, { digest: out.digest })
    }

    return { ok: true, manifest, digest, downloaded, anchored }
}

/** Grobe UI-Schätzung (§ H.33c Schritt 4). */
export function estimateEinsatzManifestAnchorCostHint(messageCount: number): string {
    if (messageCount <= 0) return 'Keine Nachrichten — kein Gas nötig.'
    return 'ca. 0,001–0,01 IOTA (Mainnet-Anker-TX, abhängig von Gas).'
}
