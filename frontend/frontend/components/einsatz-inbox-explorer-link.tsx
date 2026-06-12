'use client'

import { ExternalLink } from 'lucide-react'
import {
    einsatzChainModeSourceNetwork,
    type EinsatzChainMode,
} from '@morgendrot/shared/einsatz-chain-mode'
import {
    explorerTxUrlForEinsatzChain,
    shortTxDigestLabel,
} from '@/frontend/lib/einsatz-explorer-url'

export function EinsatzInboxExplorerLink(p: {
    txDigest: string
    chainMode: EinsatzChainMode
    rpcHint?: string
}) {
    const digest = p.txDigest.trim()
    if (!digest) return null
    const href = explorerTxUrlForEinsatzChain(digest, p.chainMode, p.rpcHint)
    if (!href) return null
    const net = einsatzChainModeSourceNetwork(p.chainMode, p.rpcHint ?? '')
    const netLabel = net === 'testnet' ? 'Testnet' : 'Mainnet'
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium text-slate-800 hover:bg-slate-500/25 dark:text-slate-200"
            title={`Transaktion im ${netLabel}-Explorer öffnen`}
        >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            Tx {shortTxDigestLabel(digest)} ({netLabel})
        </a>
    )
}
