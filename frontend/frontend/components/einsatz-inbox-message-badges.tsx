'use client'

import { Anchor, Layers, Link2 } from 'lucide-react'
import {
    einsatzInboxBadgesVisible,
    type EinsatzInboxMessageBadges,
} from '@/frontend/lib/einsatz-inbox-badges'
import { shortTxDigestLabel } from '@/frontend/lib/einsatz-explorer-url'

export function EinsatzInboxMessageBadges({ badges }: { badges: EinsatzInboxMessageBadges }) {
    if (!einsatzInboxBadgesVisible(badges)) return null
    const batchDigestLabel = badges.forensicBatchDigest
        ? shortTxDigestLabel(badges.forensicBatchDigest)
        : ''
    return (
        <>
            {badges.onChainMainnet ? (
                <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-900 dark:text-cyan-200"
                    title="Nachricht liegt on-chain auf Mainnet (Mailbox / Team-Broadcast)"
                >
                    <Link2 className="h-3 w-3 shrink-0" aria-hidden />
                    On-chain (Mainnet)
                </span>
            ) : null}
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
