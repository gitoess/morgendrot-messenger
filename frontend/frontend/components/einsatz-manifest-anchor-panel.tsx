'use client'

import { useMemo, useState } from 'react'
import { Anchor } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { fetchInboxFromAllOwnedMailboxes } from '@/frontend/lib/inbox-multi-mailbox-fetch'
import {
    einsatzChainModeShowsManifestAnchorUi,
    describeEinsatzChainModeBanner,
} from '@morgendrot/shared/einsatz-chain-mode'
import {
    readEinsatzManifestLastAnchoredSequence,
    resolveActiveEinsatzChainMode,
    writeEinsatzManifestLastAnchoredSequence,
} from '@/frontend/lib/einsatz-chain-mode-local'
import {
    buildEinsatzManifestV1,
    downloadEinsatzManifestJson,
    type EinsatzManifestV1,
} from '@/frontend/lib/einsatz-manifest-v1'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { Button } from '@/components/ui/button'

export function EinsatzManifestAnchorPanel(p: { apiStatus?: ApiStatus | null }) {
    const chainMode = resolveActiveEinsatzChainMode()
    const showUi = einsatzChainModeShowsManifestAnchorUi(chainMode)
    const rpcHint = p.apiStatus?.rpcUrlLabel || p.apiStatus?.network
    const banner = useMemo(() => describeEinsatzChainModeBanner(chainMode, rpcHint), [chainMode, rpcHint])
    const [busy, setBusy] = useState(false)
    const [status, setStatus] = useState('')
    const [preview, setPreview] = useState<EinsatzManifestV1 | null>(null)
    const lastSeq = readEinsatzManifestLastAnchoredSequence()

    const einsatzId = useMemo(() => {
        const snap = readLocalHandoffAppliedSnapshot()
        const label = snap?.handoffLabel?.trim() || 'einsatz'
        const pkg = (snap?.packageId || p.apiStatus?.packageId || 'local').trim()
        return `${label}-${pkg.slice(0, 10)}`
    }, [p.apiStatus?.packageId])

    const buildManifest = async () => {
        setBusy(true)
        setStatus('')
        setPreview(null)
        try {
            const inbox = await fetchInboxFromAllOwnedMailboxes({
                limit: 500,
                offset: 0,
                includePrivateMailboxes: true,
            })
            if (!inbox.ok) {
                setStatus(inbox.error || 'Posteingang nicht geladen.')
                return
            }
            const pkg = (p.apiStatus?.packageId || readLocalHandoffAppliedSnapshot()?.packageId || '').trim()
            if (!pkg) {
                setStatus('PACKAGE_ID fehlt — Handoff importieren oder Basis verbinden.')
                return
            }
            const manifest = await buildEinsatzManifestV1({
                einsatzId,
                handoffLabel: readLocalHandoffAppliedSnapshot()?.handoffLabel,
                packageId: pkg,
                chainMode,
                rpcUrl: rpcHint,
                messages: inbox.messages,
                sequence: lastSeq + 1,
            })
            setPreview(manifest)
            setStatus(
                `${manifest.entries.length} Nachrichten — manifest_hash ${manifest.manifest_hash.slice(0, 12)}…`
            )
        } finally {
            setBusy(false)
        }
    }

    const onDownload = () => {
        if (!preview) return
        downloadEinsatzManifestJson(preview)
        writeEinsatzManifestLastAnchoredSequence(preview.entries.length > 0 ? lastSeq + 1 : lastSeq)
        setStatus('Manifest-Datei gespeichert. On-chain Anker (store_einsatz_manifest) folgt nach Move-Deploy.')
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
            </div>

            {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
            {preview ? (
                <pre className="max-h-32 overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-[10px]">
                    {JSON.stringify(
                        {
                            manifest_hash: preview.manifest_hash,
                            merkle_root: preview.merkle_root,
                            source_network: preview.source_network,
                            message_count: preview.entries.length,
                        },
                        null,
                        2
                    )}
                </pre>
            ) : null}
        </div>
    )
}
