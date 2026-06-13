'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Anchor, ChevronDown } from 'lucide-react'
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
import { verifySampleMerkleProofForManifest } from '@/frontend/lib/einsatz-manifest-merkle-proof'
import { verifyEinsatzManifestOnMainnetRegistry } from '@/frontend/lib/einsatz-manifest-mainnet-verify'
import {
    canTryEinsatzManifestAnchorSubmit,
    tryAnchorEinsatzManifestViaDirectIota,
    writeBossMainnetRpcOverride,
} from '@/frontend/lib/direct-iota-einsatz-manifest-anchor'
import {
    canTryCreateEinsatzManifestRegistry,
    tryCreateEinsatzManifestRegistryViaDirectIota,
} from '@/frontend/lib/direct-iota-einsatz-manifest-registry-create'
import { describeCreateEinsatzManifestRegistryBlockReason } from '@/frontend/lib/einsatz-manifest-registry-ui'
import {
    resolveMainnetPackageId,
    resolveMainnetRpcUrlForUi,
    writeBossMainnetPackageOverride,
} from '@/frontend/lib/einsatz-mainnet-local-config'
import { setConfig } from '@/frontend/lib/api/dashboard-rest'
import {
    readLastEinsatzManifestAnchorMeta,
    writeAnchoredManifestFromV1,
} from '@/frontend/lib/einsatz-manifest-anchor-cache'
import { probeEinsatzManifestSequenceOnChain } from '@/frontend/lib/einsatz-manifest-on-chain-probe'
import { listEinsatzManifestAnchorsOnMainnet } from '@/frontend/lib/einsatz-manifest-anchors-list'
import type { EinsatzManifestAnchorRow } from '@morgendrot/core/iota'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export function EinsatzManifestAnchorPanel(p: {
    apiStatus?: ApiStatus | null
    onRefreshStatus?: () => void | Promise<void>
}) {
    const chainMode = resolveActiveEinsatzChainMode()
    const showUi = einsatzChainModeShowsManifestAnchorUi(chainMode)
    const networkLabel = p.apiStatus?.rpcUrlLabel || p.apiStatus?.network
    const banner = useMemo(() => describeEinsatzChainModeBanner(chainMode, networkLabel), [chainMode, networkLabel])
    const einsatzCfg = p.apiStatus?.einsatzConfig
    const [registryOverride, setRegistryOverride] = useState('')
    const registryId = registryOverride || einsatzCfg?.einsatzManifestRegistryId || ''
    const mainnetRpcFromStatus = einsatzCfg?.mainnetRpcUrl ?? ''
    const mainnetPackageId = resolveMainnetPackageId({
        chainMode,
        fromApiStatus: einsatzCfg?.mainnetPackageId,
        operationPackageId: p.apiStatus?.packageId,
    })
    const [mainnetPkgDraft, setMainnetPkgDraft] = useState('')
    const [mainnetRpcDraft, setMainnetRpcDraft] = useState('')
    const [mainnetCfgOpen, setMainnetCfgOpen] = useState(false)

    const [busy, setBusy] = useState(false)
    const [status, setStatus] = useState('')
    const [preview, setPreview] = useState<EinsatzManifestV1 | null>(null)
    const [imported, setImported] = useState<EinsatzManifestV1 | null>(null)
    const [lastAnchorDigest, setLastAnchorDigest] = useState('')
    const [onChainProbe, setOnChainProbe] = useState('')
    const [anchorList, setAnchorList] = useState<EinsatzManifestAnchorRow[]>([])
    const [moreOpen, setMoreOpen] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)
    const lastSeq = readEinsatzManifestLastAnchoredSequence()
    const lastAnchorMeta = readLastEinsatzManifestAnchorMeta()
    const activeManifest = preview ?? imported
    const canAnchor = canTryEinsatzManifestAnchorSubmit(registryId)
    const pkgForRegistry =
        mainnetPackageId ||
        (chainMode === 'testnet-with-mainnet-anchor' ? '' : p.apiStatus?.packageId?.trim() ?? '')
    const canCreateRegistry = canTryCreateEinsatzManifestRegistry({
        registryObjectId: registryId,
        mainnetPackageId: pkgForRegistry,
    })
    const registryBlockReason = describeCreateEinsatzManifestRegistryBlockReason({
        registryObjectId: registryId,
        mainnetPackageId: pkgForRegistry,
        chainMode,
        packageId: p.apiStatus?.packageId,
    })

    useEffect(() => {
        setMainnetPkgDraft(mainnetPackageId)
        setMainnetRpcDraft(
            resolveMainnetRpcUrlForUi({ fromApiStatus: mainnetRpcFromStatus }) ||
                'https://api.mainnet.iota.cafe'
        )
    }, [mainnetPackageId, mainnetRpcFromStatus])

    const saveMainnetConfig = async () => {
        const pkg = mainnetPkgDraft.trim()
        const rpc = mainnetRpcDraft.trim()
        if (pkg && !/^0x[a-fA-F0-9]{64}$/i.test(pkg)) {
            setStatus('Mainnet-Package: 0x + 64 Hex-Zeichen.')
            return
        }
        if (rpc && !rpc.startsWith('http://') && !rpc.startsWith('https://')) {
            setStatus('Mainnet-RPC: gültige https://-URL.')
            return
        }
        setBusy(true)
        try {
            writeBossMainnetPackageOverride(pkg)
            writeBossMainnetRpcOverride(rpc)
            let note = 'Mainnet-Einstellungen auf diesem Gerät gespeichert.'
            if (p.apiStatus?.backendOnline) {
                if (pkg) {
                    const r = await setConfig('MAINNET_PACKAGE_ID', pkg)
                    if (!r.ok) note += ` Package (Boss): ${r.error || 'Fehler'}.`
                }
                if (rpc) {
                    const r = await setConfig('MAINNET_RPC_URL', rpc)
                    if (!r.ok) note += ` RPC (Boss): ${r.error || 'Fehler'}.`
                } else {
                    note += ' Boss-RPC unverändert.'
                }
                await p.onRefreshStatus?.()
            } else {
                note += ' Boss-PC offline — nur lokal; beim nächsten Sync Boss erneut speichern.'
            }
            setStatus(note)
        } finally {
            setBusy(false)
        }
    }

    const verifyManifest = async (manifest: EinsatzManifestV1): Promise<string | null> => {
        const structural = await verifyEinsatzManifestV1(manifest)
        if (!structural.ok) return structural.error

        const entryHashes = manifest.entries.map((e) => e.entry_hash).sort()
        const merkleSample = await verifySampleMerkleProofForManifest({
            sortedEntryHashesHex: entryHashes,
            merkleRootHex: manifest.merkle_root,
        })
        if (!merkleSample.ok) return `Merkle ungültig: ${merkleSample.error}`

        const inbox = await fetchInboxFromAllOwnedMailboxes({
            limit: 500,
            offset: 0,
            includePrivateMailboxes: true,
        })
        if (!inbox.ok) return `Posteingang nicht geladen: ${inbox.error || 'Fehler'}`

        const match = await matchEinsatzManifestAgainstInbox(manifest, inbox.messages)
        if (!match.ok) return `Abgleich fehlgeschlagen: ${match.error}`

        if (registryId) {
            const onMainnet = await verifyEinsatzManifestOnMainnetRegistry({
                manifest,
                apiStatus: p.apiStatus,
            })
            if (onMainnet.ok) {
                return `${match.matchedCount} Nachrichten stimmen überein — Mainnet-Anker Seq. ${onMainnet.row.sequence} bestätigt.`
            }
            return `${match.matchedCount} Nachrichten stimmen überein — Mainnet: ${onMainnet.error}`
        }
        return `${match.matchedCount} Nachrichten stimmen mit dem Posteingang überein.`
    }

    const buildManifest = async () => {
        setBusy(true)
        setStatus('')
        setPreview(null)
        setLastAnchorDigest('')
        try {
            const built = await buildEinsatzManifestFromInbox({
                apiStatus: p.apiStatus,
                chainMode,
            })
            if (!built.ok) {
                setStatus(built.error)
                return
            }
            const manifest = built.manifest
            setPreview(manifest)
            setImported(null)
            const withDigest = manifest.entries.filter((e) => e.source_tx_digest).length
            const verifyNote = await verifyManifest(manifest)
            setStatus(
                verifyNote ??
                    `${manifest.entries.length} Nachrichten (${withDigest} mit Chain-Bezug) — ${estimateEinsatzManifestAnchorCostHint(manifest.entries.length)}`
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
        setStatus('JSON-Datei gespeichert.')
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
            const verifyNote = await verifyManifest(parsed)
            setStatus(verifyNote ?? `Import: ${parsed.entries.length} Einträge geladen.`)
        } finally {
            setBusy(false)
        }
    }

    const onCreateRegistry = async () => {
        if (!pkgForRegistry) {
            setStatus('Mainnet-Package fehlt — Boss-.env oder Deploy-Doku.')
            return
        }
        setBusy(true)
        setStatus('')
        try {
            const out = await tryCreateEinsatzManifestRegistryViaDirectIota({
                mainnetPackageId: pkgForRegistry,
                mainnetRpcFromStatus,
            })
            if (!out.ok) {
                setStatus(out.error)
                return
            }
            const cfg = await setConfig('EINSATZ_MANIFEST_REGISTRY_ID', out.registryId)
            if (!cfg.ok) {
                setStatus(
                    `Registry angelegt (${out.registryId.slice(0, 12)}…) — .env nicht geschrieben: ${cfg.error || 'API-Fehler'}.`
                )
                setRegistryOverride(out.registryId)
                return
            }
            if (chainMode === 'testnet-with-mainnet-anchor' && pkgForRegistry) {
                await setConfig('MAINNET_PACKAGE_ID', pkgForRegistry)
            }
            setRegistryOverride(out.registryId)
            await p.onRefreshStatus?.()
            setStatus(
                out.digest
                    ? `Mainnet-Registry bereit — TX ${shortTxDigestLabel(out.digest)}`
                    : 'Mainnet-Registry bereit — jetzt Zusammenfassung bauen und speichern.'
            )
        } finally {
            setBusy(false)
        }
    }

    const onListMainnetAnchors = async () => {
        setBusy(true)
        setOnChainProbe('')
        setAnchorList([])
        try {
            const out = await listEinsatzManifestAnchorsOnMainnet({ apiStatus: p.apiStatus })
            if (!out.ok) {
                setOnChainProbe(out.error)
                return
            }
            setAnchorList(out.rows)
            setOnChainProbe(
                out.rows.length
                    ? `${out.rows.length} gespeicherte Beweise auf Mainnet.`
                    : 'Noch keine Beweise auf Mainnet für diesen Einsatz.'
            )
        } finally {
            setBusy(false)
        }
    }

    const onProbeOnChain = async () => {
        const seq = activeManifest?.sequence ?? lastAnchorMeta?.sequence ?? lastSeq
        if (!seq || seq < 1) {
            setOnChainProbe('Keine Sequenz — zuerst Zusammenfassung bauen.')
            return
        }
        setBusy(true)
        setOnChainProbe('')
        try {
            const out = await probeEinsatzManifestSequenceOnChain({
                apiStatus: p.apiStatus,
                sequence: seq,
            })
            if (!out.ok) {
                setOnChainProbe(out.error)
                return
            }
            setOnChainProbe(
                out.exists
                    ? `Sequenz ${out.sequence} ist auf Mainnet gespeichert.`
                    : `Sequenz ${out.sequence} auf Mainnet nicht gefunden.`
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
                setStatus('Mainnet-Package fehlt — Boss-.env setzen.')
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
                    ? `Auf Mainnet gespeichert — ${shortTxDigestLabel(out.digest)}`
                    : 'Auf Mainnet gespeichert.'
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
                <div className="min-w-0 space-y-2">
                    <h4 className="font-semibold text-foreground">Kurz-Beweis (Mainnet)</h4>
                    <p className="text-sm text-muted-foreground">
                        Erstellt eine <strong className="font-medium text-foreground">Zusammenfassung</strong> aller
                        Nachrichten (Hashes + Merkle-Baum) — <em>ohne</em> vollen Text on-chain. {banner.title}. Letzte
                        Sequenz: {lastSeq}.
                    </p>
                    {chainMode === 'testnet-with-mainnet-anchor' ? (
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                            Ihr sendet auf <strong>Testnet</strong> — kein extra Login nötig. Mainnet-Schritte hier
                            speichern nur den Beweis-Hash; dafür braucht die Puls-Wallet{' '}
                            <strong>IOTA-Gas auf Mainnet</strong> (nicht Testnet-Guthaben).
                        </p>
                    ) : null}
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                        <li>
                            <strong className="font-medium text-foreground">Wallet</strong> — Einstellungen → System
                            &amp; Identität → „Mailbox · Direkt-RPC · Streams-Puls“ → Session-Signer (Mnemonic). Name
                            „Puls“ = optionaler Live-Monitor zur Basis, nicht die Wallet selbst.
                        </li>
                        <li>
                            <strong className="font-medium text-foreground">Registry</strong> — einmaliges Mainnet-Konto
                            für Fingerabdrücke.{registryId ? ' Bereit.' : ' Noch nicht eingerichtet.'}
                        </li>
                        <li>
                            <strong className="font-medium text-foreground">Zusammenfassung bauen</strong> — liest den
                            Posteingang und prüft die Integrität.
                        </li>
                        <li>
                            <strong className="font-medium text-foreground">Auf Mainnet speichern</strong> — schreibt nur
                            den Hash (wenig Gas, Session-Signer).
                        </li>
                    </ul>
                </div>
            </div>

            <Collapsible open={mainnetCfgOpen} onOpenChange={setMainnetCfgOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronDown
                        className={cn('h-3.5 w-3.5 transition-transform', mainnetCfgOpen && 'rotate-180')}
                        aria-hidden
                    />
                    Mainnet-Einstellungen (Package + RPC)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                        Für Registry und Kurz-Beweis auf Mainnet — hier im Messenger setzen (speichert lokal; bei
                        erreichbarem Boss-PC auch in dessen .env).
                    </p>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Mainnet-Package-ID (0x…)</Label>
                        <Input
                            className="h-8 font-mono text-xs"
                            value={mainnetPkgDraft}
                            onChange={(e) => setMainnetPkgDraft(e.target.value)}
                            placeholder="0x…64 hex — Move auf Mainnet deployed"
                            spellCheck={false}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Mainnet-RPC (optional)</Label>
                        <Input
                            className="h-8 font-mono text-xs"
                            value={mainnetRpcDraft}
                            onChange={(e) => setMainnetRpcDraft(e.target.value)}
                            placeholder="https://api.mainnet.iota.cafe"
                            spellCheck={false}
                        />
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void saveMainnetConfig()}>
                        Speichern
                    </Button>
                </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-wrap gap-2">
                {!registryId ? (
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!canCreateRegistry || busy}
                            onClick={() => void onCreateRegistry()}
                        >
                            Mainnet vorbereiten
                        </Button>
                        {registryBlockReason ? (
                            <p className="w-full text-xs text-amber-800 dark:text-amber-200">{registryBlockReason}</p>
                        ) : null}
                    </>
                ) : null}
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void buildManifest()}>
                    {busy ? 'Sammle…' : 'Zusammenfassung bauen'}
                </Button>
                <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={!activeManifest || !canAnchor || busy}
                    onClick={() => void onAnchor()}
                >
                    Auf Mainnet speichern
                </Button>
            </div>

            {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
            {onChainProbe ? <p className="text-xs text-muted-foreground">{onChainProbe}</p> : null}
            {lastAnchorMeta?.digest || lastAnchorDigest ? (
                <p className="text-xs">
                    <a
                        href={explorerTxUrlForMainnetAnchor(lastAnchorDigest || lastAnchorMeta!.digest!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                        Letzter Mainnet-Eintrag:{' '}
                        {shortTxDigestLabel(lastAnchorDigest || lastAnchorMeta!.digest!)}
                    </a>
                </p>
            ) : null}
            {chainMode === 'testnet-with-mainnet-anchor' && activeManifest ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                    Nachrichten liegen auf Testnet — auf Mainnet wird nur der Hash gespeichert.
                </p>
            ) : null}
            {activeManifest ? (
                <p className="text-xs font-mono text-muted-foreground">
                    Seq. {activeManifest.sequence} · {activeManifest.entries.length} Nachrichten · Hash{' '}
                    {activeManifest.manifest_hash.slice(0, 12)}…
                </p>
            ) : null}

            <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', moreOpen && 'rotate-180')} aria-hidden />
                    Mehr (JSON, Chain-Abfrage)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={!preview} onClick={onDownload}>
                            JSON exportieren
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => fileRef.current?.click()}
                        >
                            JSON importieren
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!registryId || busy}
                            onClick={() => void onListMainnetAnchors()}
                        >
                            Mainnet-Einträge anzeigen
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!registryId || busy}
                            onClick={() => void onProbeOnChain()}
                        >
                            Sequenz auf Mainnet prüfen
                        </Button>
                    </div>
                    {anchorList.length > 0 ? (
                        <ul className="max-h-28 overflow-auto rounded border border-border bg-muted/30 p-2 text-[10px] font-mono space-y-1">
                            {anchorList.map((row) => (
                                <li key={`${row.sequence}-${row.anchorObjectId ?? row.manifestHashHex}`}>
                                    Seq. {row.sequence} — {row.messageCount ?? '?'} Nachrichten
                                    {row.manifestHashHex ? ` — ${row.manifestHashHex.slice(0, 12)}…` : null}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </CollapsibleContent>
            </Collapsible>

            <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
            />
        </div>
    )
}
