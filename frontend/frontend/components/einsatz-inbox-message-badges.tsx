'use client'

import { Anchor, Layers } from 'lucide-react'
import { type EinsatzInboxMessageBadges } from '@/frontend/lib/einsatz-inbox-badges'
import { shortTxDigestLabel } from '@/frontend/lib/einsatz-explorer-url'

export function EinsatzInboxMessageBadges({ badges }: { badges: EinsatzInboxMessageBadges }) {
    /**
     * „On-chain (Mainnet)“-Label absichtlich nicht mehr: doppelt/missverständlich neben dem
     * klickbaren Explorer-Badge „On-chain (Testnet|Mainnet)“ (`inbox-message-explorer`).
     * Forensic-Batch + Einsatz-Anker bleiben.
     */
    if (!badges.inForensicBatch && !badges.inEinsatzAnchor) return null
    const batchDigestLabel = badges.forensicBatchDigest
        ? shortTxDigestLabel(badges.forensicBatchDigest)
        : ''
    return (
        <>
            {badges.inForensicBatch ? (
                <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-200"
                    title={
                        batchDigestLabel
                            ? `Mainnet-Batch-Archiv — TX ${batchDigestLabel}`
                            : 'Mainnet-Batch-Archiv (§ H.33e)'
                    }
                >
                    <Layers className="h-3 w-3 shrink-0" aria-hidden />
                    Batch-archiviert
                </span>
            ) : null}
            {badges.inEinsatzAnchor ? (
                <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-900 dark:text-indigo-200"
                    title="Eintrag im Einsatz-Manifest-Rollup verankert (off-chain Hash + optional Mainnet-Anker)"
                >
                    <Anchor className="h-3 w-3 shrink-0" aria-hidden />
                    Im Einsatz-Anker enthalten
                </span>
            ) : null}
        </>
    )
}
