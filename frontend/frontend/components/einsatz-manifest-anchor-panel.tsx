'use client'

import { useMemo, useRef, useState } from 'react'
import { Anchor } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { fetchInboxFromAllOwnedMailboxes } from '@/frontend/lib/inbox-multi-mailbox-fetch'
import {
    buildEinsatzManifestFromInbox,
    estimateEinsatzManifestAnchorCostHint,
} from '@/frontend/lib/einsatz-manifest-anchor-flow'
import { explorerTxUrlForMainnetAnchor, shortTxDigestLabel } from '@/frontend/lib/einsatz-explorer-url'
import {
    einsatzChainModeShowsManifestAnchorUi,
    describeEinsatzChainModeBanner,
} from '@morgendrot/shared/einsatz-chain-mode'
import {
    readEinsatzManifestLastAnchoredSequence,
    resolveActiveEinsatzChainMode,
    writeEinsatzManifestLastAnchoredSequence,
} from '@/frontend/lib/einsatz-chain-mode-local'
import { downloadEinsatzManifestJson, type EinsatzManifestV1 } from '@/frontend/lib/einsatz-manifest-v1'
import {
    matchEinsatzManifestAgainstInbox,
    parseEinsatzManifestV1Json,
} from '@/frontend/lib/einsatz-manifest-inbox-match'
import { verifyEinsatzManifestV1 } from '@/frontend/lib/einsatz-manifest-verify'
import {
    canTryEinsatzManifestAnchorSubmit,
    tryAnchorEinsatzManifestViaDirectIota,
    writeBossMainnetRpcOverride,
} from '@/frontend/lib/direct-iota-einsatz-manifest-anchor'
import { writeAnchoredManifestFromV1 } from '@/frontend/lib/einsatz-manifest-anchor-cache'
import { Button } from '@/components/ui/button'

export function EinsatzManifestAnchorPanel(p: { apiStatus?: ApiStatus | null }) {
    const chainMode = resolveActiveEinsatzChainMode()
    const showUi = einsatzChainModeShowsManifestAnchorUi(chainMode)
    const rpcHint = p.apiStatus?.rpcUrlLabel || p.apiStatus?.network
    const banner = useMemo(() => describeEinsatzChainModeBanner(chainMode, rpcHint), [chainMode, rpcHint])
    const einsatzCfg = p.apiStatus?.einsatzConfig
    const registryId = einsatzCfg?.einsatzManifestRegistryId ?? ''
    const mainnetRpcFromStatus = einsatzCfg?.mainnetRpcUrl ?? ''
    const mainnetPackageId =
        einsatzCfg?.mainnetPackageId?.trim() ||
        (chainMode === 'testnet-with-mainnet-anchor' ? '' : p.apiStatus?.packageId?.trim() ?? '')

    const [busy, setBusy] = useState(false)
    const [status, setStatus] = useState('')
    const [preview, setPreview] = useState<EinsatzManifestV1 | null>(null)
    const [imported, setImported] = useState<EinsatzManifestV1 | null>(null)
    const [lastAnchorDigest, setLastAnchorDigest] = useState('')
    const fileRef = useRef<HTMLInputElement>(null)
    const lastSeq = readEinsatzManifestLastAnchoredSequence()
    const activeManifest = preview ?? imported
    const canAnchor = canTryEinsatzManifestAnchorSubmit(registryId)

    const buildManifest = async () => {
        setBusy(true)
        setStatus('')
        setPreview(null)
        setLastAnchorDigest('')
        try {
            const built = await buildEinsatzManifestFromInbox({
                apiStatus: p.apiStatus,
                chainMode,
                rpcHint,
            })
            if (!built.ok) {
                setStatus(built.error)
                return
            }
            const manifest = built.manifest
            setPreview(manifest)
            setImported(null)
            const withDigest = manifest.entries.filter((e) => e.source_tx_digest).length
            setStatus(
                `${manifest.entries.length} Nachrichten (${withDigest} mit Tx-Digest) — ${estimateEinsatzManifestAnchorCostHint(manifest.entries.length)} — manifest_hash ${manifest.manifest_hash.slice(0, 12)}…`
            )
        } finally {
            setBusy(false)
        }
    }

    const onDownload = () => {
        if (!preview) return
        downloadEinsatzManifestJson(preview)
        writeEinsatzManifestLastAnchoredSequence(preview.sequence)
        writeAnchoredManifestFromV1(preview)
        setStatus('Manifest-Datei gespeichert — Posteingang-Badges aktualisiert.')
    }

    const onImportFile = async (file: File | null) => {
        if (!file) return
        setBusy(true)
        setStatus('')
        try {
            const raw = await file.text()
            const parsed = parseEinsatzManifestV1Json(raw)
            if ('error' in parsed) {
                setStatus(parsed.error)
                return
            }
            setImported(parsed)
            setPreview(null)
            writeAnchoredManifestFromV1(parsed)
            setStatus(`Import: ${parsed.entries.length} Einträge — Badges im Posteingang aktualisiert.`)
        } finally {
            setBusy(false)
        }
    }

    const onVerify = async () => {
        if (!activeManifest) return
        setBusy(true)
        setStatus('')
        try {
            const structural = await verifyEinsatzManifestV1(activeManifest)
            if (!structural.ok) {
                setStatus(structural.error)
                return
            }
            const inbox = await fetchInboxFromAllOwnedMailboxes({
                limit: 500,
                offset: 0,
                includePrivateMailboxes: true,
            })
            if (!inbox.ok) {
                setStatus(`Struktur OK — Posteingang: ${inbox.error || 'nicht geladen'}`)
                return
            }
            const match = await matchEinsatzManifestAgainstInbox(activeManifest, inbox.messages)
            if (!match.ok) {
                setStatus(`Struktur OK — Abgleich: ${match.error}`)
                return
            }
            setStatus(
                `Verifikation OK — ${match.matchedCount} Treffer, ${match.manifestOnlyCount} nur Manifest, ${match.inboxOnlyCount} nur Posteingang.`
            )
        } finally {
            setBusy(false)
        }
    }

    const onAnchor = async () => {
        if (!activeManifest) return
        setBusy(true)
        setStatus('')
        try {
            if (mainnetRpcFromStatus) writeBossMainnetRpcOverride(mainnetRpcFromStatus)
            const pkgForAnchor =
                chainMode === 'testnet-with-mainnet-anchor'
                    ? mainnetPackageId
                    : activeManifest.source_package_id.trim()
            if (!pkgForAnchor) {
                setStatus('MAINNET_PACKAGE_ID fehlt (Modus A) — Boss-.env setzen.')
                return
            }
            const out = await tryAnchorEinsatzManifestViaDirectIota({
                manifest: activeManifest,
                registryObjectId: registryId,
                mainnetPackageId: pkgForAnchor,
                mainnetRpcFromStatus,
            })
            if (!out.ok) {
                setStatus(out.error)
                return
            }
            writeEinsatzManifestLastAnchoredSequence(activeManifest.sequence)
            writeAnchoredManifestFromV1(activeManifest, { digest: out.digest })
            if (out.digest) setLastAnchorDigest(out.digest)
            setStatus(
                out.digest
                    ? `On-chain verankert — Digest ${shortTxDigestLabel(out.digest)} — Badges aktualisiert.`
                    : 'On-chain verankert — Badges aktualisiert.'
            )
        } finally {
            setBusy(false)
        }
    }

    if (!showUi) return null

    return (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Anchor className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1">
                    <h4 className="font-semibold text-foreground">Einsatz-Protokoll verankern</h4>
                    <p className="text-sm text-muted-foreground">
                        Rollup-Manifest (off-chain) für Forensik — {banner.title}. Letzte Sequenz: {lastSeq}.
                        {registryId
                            ? ' Registry konfiguriert.'
                            : ' Registry fehlt — nach Move-Deploy EINSATZ_MANIFEST_REGISTRY_ID setzen.'}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void buildManifest()}>
                    {busy ? 'Sammle…' : 'Manifest bauen'}
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={!preview} onClick={onDownload}>
                    Manifest speichern
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                >
                    Manifest importieren
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!activeManifest || busy}
                    onClick={() => void onVerify()}
                >
                    Verifizieren
                </Button>
                <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={!activeManifest || !canAnchor || busy}
                    title={
                        canAnchor
                            ? 'store_einsatz_manifest auf Chain senden'
                            : 'Registry + Session-Signer (Puls) erforderlich'
                    }
                    onClick={() => void onAnchor()}
                >
                    On-chain ankern
                </Button>
            </div>
            <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
            />

            {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
            {lastAnchorDigest ? (
                <p className="text-xs">
                    <a
                        href={explorerTxUrlForMainnetAnchor(lastAnchorDigest)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                        Mainnet-Anker im Explorer öffnen ({shortTxDigestLabel(lastAnchorDigest)})
                    </a>
                </p>
            ) : null}
            {chainMode === 'testnet-with-mainnet-anchor' && activeManifest ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                    Testnet-Betrieb: Nachrichten liegen auf Testnet — Mainnet-Anker speichert nur Hash/Merkle.
                </p>
            ) : null}
            {activeManifest ? (
                <pre className="max-h-32 overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-[10px]">
                    {JSON.stringify(
                        {
                            manifest_hash: activeManifest.manifest_hash,
                            merkle_root: activeManifest.merkle_root,
                            source_network: activeManifest.source_network,
                            sequence: activeManifest.sequence,
                            message_count: activeManifest.entries.length,
                        },
                        null,
                        2
                    )}
                </pre>
            ) : null}
        </div>
    )
}
