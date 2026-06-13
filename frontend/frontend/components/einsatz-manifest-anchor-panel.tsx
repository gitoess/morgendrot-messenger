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
            setStatus('Mainnet package: 0x + 64 hex characters.')
            return
        }
        if (rpc && !rpc.startsWith('http://') && !rpc.startsWith('https://')) {
            setStatus('Mainnet RPC: valid https:// URL.')
            return
        }
        setBusy(true)
        try {
            writeBossMainnetPackageOverride(pkg)
            writeBossMainnetRpcOverride(rpc)
            let note = 'Mainnet settings saved on this device.'
            if (p.apiStatus?.backendOnline) {
                if (pkg) {
                    const r = await setConfig('MAINNET_PACKAGE_ID', pkg)
                    if (!r.ok) note += ` Package (boss): ${r.error || 'error'}.`
                }
                if (rpc) {
                    const r = await setConfig('MAINNET_RPC_URL', rpc)
                    if (!r.ok) note += ` RPC (boss): ${r.error || 'error'}.`
                } else {
                    note += ' Boss RPC unchanged.'
                }
                await p.onRefreshStatus?.()
            } else {
                note += ' Boss PC offline — local only; save on boss again at next sync.'
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
        if (!merkleSample.ok) return `Invalid Merkle tree: ${merkleSample.error}`

        const inbox = await fetchInboxFromAllOwnedMailboxes({
            limit: 500,
            offset: 0,
            includePrivateMailboxes: true,
        })
        if (!inbox.ok) return `Could not load inbox: ${inbox.error || 'error'}`

        const match = await matchEinsatzManifestAgainstInbox(manifest, inbox.messages)
        if (!match.ok) return `Match failed: ${match.error}`

        if (registryId) {
            const onMainnet = await verifyEinsatzManifestOnMainnetRegistry({
                manifest,
                apiStatus: p.apiStatus,
            })
            if (onMainnet.ok) {
                return `${match.matchedCount} messages match — mainnet anchor seq. ${onMainnet.row.sequence} confirmed.`
            }
            return `${match.matchedCount} messages match — mainnet: ${onMainnet.error}`
        }
        return `${match.matchedCount} messages match the inbox.`
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
                    `${manifest.entries.length} messages (${withDigest} with chain reference) — ${estimateEinsatzManifestAnchorCostHint(manifest.entries.length)}`
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
        setStatus('JSON file saved.')
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
            setStatus(verifyNote ?? `Import: ${parsed.entries.length} entries loaded.`)
        } finally {
            setBusy(false)
        }
    }

    const onCreateRegistry = async () => {
        if (!pkgForRegistry) {
            setStatus('Mainnet package missing — boss .env or deploy docs.')
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
                    `Registry created (${out.registryId.slice(0, 12)}…) — .env not written: ${cfg.error || 'API error'}.`
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
                    ? `Mainnet registry ready — TX ${shortTxDigestLabel(out.digest)}`
                    : 'Mainnet registry ready — now build summary and save.'
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
                    ? `${out.rows.length} stored proofs on mainnet.`
                    : 'No proofs on mainnet yet for this deployment.'
            )
        } finally {
            setBusy(false)
        }
    }

    const onProbeOnChain = async () => {
        const seq = activeManifest?.sequence ?? lastAnchorMeta?.sequence ?? lastSeq
        if (!seq || seq < 1) {
            setOnChainProbe('No sequence — build summary first.')
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
                    ? `Sequence ${out.sequence} is stored on mainnet.`
                    : `Sequence ${out.sequence} not found on mainnet.`
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
                setStatus('Mainnet package missing — set boss .env.')
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
                    ? `Saved on mainnet — ${shortTxDigestLabel(out.digest)}`
                    : 'Saved on mainnet.'
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
                    <h4 className="font-semibold text-foreground">Short proof (mainnet)</h4>
                    <p className="text-sm text-muted-foreground">
                        Creates a <strong className="font-medium text-foreground">summary</strong> of all messages
                        (hashes + Merkle tree) — <em>without</em> full text on-chain. {banner.title}. Last sequence:{' '}
                        {lastSeq}.
                    </p>
                    {chainMode === 'testnet-with-mainnet-anchor' ? (
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                            You send on <strong>testnet</strong> — no extra login needed. Mainnet steps here only store
                            the proof hash; the Pulse wallet needs <strong>IOTA gas on mainnet</strong> (not testnet
                            balance).
                        </p>
                    ) : null}
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                        <li>
                            <strong className="font-medium text-foreground">Wallet</strong> — Settings → System
                            &amp; Identity → &quot;Mailbox · Direct RPC · Streams Pulse&quot; → session signer (mnemonic).
                            &quot;Pulse&quot; is an optional live monitor to the basis server, not the wallet itself.
                        </li>
                        <li>
                            <strong className="font-medium text-foreground">Registry</strong> — one-time mainnet account
                            for fingerprints.{registryId ? ' Ready.' : ' Not set up yet.'}
                        </li>
                        <li>
                            <strong className="font-medium text-foreground">Build summary</strong> — reads the inbox and
                            checks integrity.
                        </li>
                        <li>
                            <strong className="font-medium text-foreground">Save on mainnet</strong> — writes only the hash
                            (low gas, session signer).
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
                    Mainnet settings (package + RPC)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                        For registry and short proof on mainnet — set here in the messenger (saved locally; also written to
                        boss .env when the boss PC is reachable).
                    </p>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Mainnet package ID (0x…)</Label>
                        <Input
                            className="h-8 font-mono text-xs"
                            value={mainnetPkgDraft}
                            onChange={(e) => setMainnetPkgDraft(e.target.value)}
                            placeholder="0x…64 hex — Move deployed on mainnet"
                            spellCheck={false}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Mainnet RPC (optional)</Label>
                        <Input
                            className="h-8 font-mono text-xs"
                            value={mainnetRpcDraft}
                            onChange={(e) => setMainnetRpcDraft(e.target.value)}
                            placeholder="https://api.mainnet.iota.cafe"
                            spellCheck={false}
                        />
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void saveMainnetConfig()}>
                        Save
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
                            Prepare mainnet
                        </Button>
                        {registryBlockReason ? (
                            <p className="w-full text-xs text-amber-800 dark:text-amber-200">{registryBlockReason}</p>
                        ) : null}
                    </>
                ) : null}
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void buildManifest()}>
                    {busy ? 'Collecting…' : 'Build summary'}
                </Button>
                <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={!activeManifest || !canAnchor || busy}
                    onClick={() => void onAnchor()}
                >
                    Save on mainnet
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
                        Last mainnet entry:{' '}
                        {shortTxDigestLabel(lastAnchorDigest || lastAnchorMeta!.digest!)}
                    </a>
                </p>
            ) : null}
            {chainMode === 'testnet-with-mainnet-anchor' && activeManifest ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                    Messages are on testnet — only the hash is stored on mainnet.
                </p>
            ) : null}
            {activeManifest ? (
                <p className="text-xs font-mono text-muted-foreground">
                    Seq. {activeManifest.sequence} · {activeManifest.entries.length} messages · hash{' '}
                    {activeManifest.manifest_hash.slice(0, 12)}…
                </p>
            ) : null}

            <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', moreOpen && 'rotate-180')} aria-hidden />
                    More (JSON, chain query)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={!preview} onClick={onDownload}>
                            Export JSON
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => fileRef.current?.click()}
                        >
                            Import JSON
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!registryId || busy}
                            onClick={() => void onListMainnetAnchors()}
                        >
                            Show mainnet entries
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!registryId || busy}
                            onClick={() => void onProbeOnChain()}
                        >
                            Check sequence on mainnet
                        </Button>
                    </div>
                    {anchorList.length > 0 ? (
                        <ul className="max-h-28 overflow-auto rounded border border-border bg-muted/30 p-2 text-[10px] font-mono space-y-1">
                            {anchorList.map((row) => (
                                <li key={`${row.sequence}-${row.anchorObjectId ?? row.manifestHashHex}`}>
                                    Seq. {row.sequence} — {row.messageCount ?? '?'} messages
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
