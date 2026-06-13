'use client'

import {
    einsatzChainModeShowsManifestAnchorUi,
    type EinsatzChainMode,
} from '@morgendrot/shared/einsatz-chain-mode'
import {
    buildEinsatzManifestCanonicalMsgRef,
    buildEinsatzManifestEntryHash,
} from '@/frontend/lib/einsatz-manifest-v1'
import { lookupForensicBatchEntry } from '@/frontend/lib/forensic-batch-registry'
import type { Message } from '@/frontend/lib/types'

export type EinsatzInboxMessageBadges = {
    inEinsatzAnchor: boolean
    onChainMainnet: boolean
    inForensicBatch: boolean
    forensicBatchDigest?: string
}

export async function computeMessageManifestEntryHash(message: Message): Promise<string> {
    const canonical_msg_ref = await buildEinsatzManifestCanonicalMsgRef(message)
    return buildEinsatzManifestEntryHash({
        canonical_msg_ref,
        sender: message.from,
        timestamp_ms: message.timestamp,
        content: message.content ?? '',
    })
}

/** § H.33d — On-chain (Mainnet) nur Modus B/C; persistente Mailbox-TXs. */
export function isMessageOnChainMainnet(message: Message, chainMode: EinsatzChainMode): boolean {
    if (chainMode === 'testnet-with-mainnet-anchor') return false
    if (chainMode !== 'mainnet-direct' && chainMode !== 'mainnet-direct-no-rollup') return false
    if (message.source === 'mesh' || message.source === 'telegram') return false
    return message.chainPurgeable === true
}

export function isMessageInEinsatzAnchor(
    entryHash: string | undefined,
    anchoredHashes: ReadonlySet<string>,
    chainMode: EinsatzChainMode
): boolean {
    if (!einsatzChainModeShowsManifestAnchorUi(chainMode)) return false
    if (!entryHash?.trim()) return false
    return anchoredHashes.has(entryHash.toLowerCase())
}

export function resolveForensicBatchBadge(
    canonicalMsgRef: string | undefined
): Pick<EinsatzInboxMessageBadges, 'inForensicBatch' | 'forensicBatchDigest'> {
    if (!canonicalMsgRef?.trim()) return { inForensicBatch: false }
    const hit = lookupForensicBatchEntry(canonicalMsgRef)
    if (!hit) return { inForensicBatch: false }
    return { inForensicBatch: true, forensicBatchDigest: hit.batchDigest }
}

export function resolveEinsatzInboxMessageBadges(
    message: Message,
    chainMode: EinsatzChainMode,
    entryHash: string | undefined,
    anchoredHashes: ReadonlySet<string>,
    canonicalMsgRef?: string
): EinsatzInboxMessageBadges {
    const batch = resolveForensicBatchBadge(canonicalMsgRef)
    return {
        inEinsatzAnchor: isMessageInEinsatzAnchor(entryHash, anchoredHashes, chainMode),
        onChainMainnet: isMessageOnChainMainnet(message, chainMode),
        ...batch,
    }
}

export function einsatzInboxBadgesVisible(badges: EinsatzInboxMessageBadges): boolean {
    return badges.inEinsatzAnchor || badges.onChainMainnet || badges.inForensicBatch
}
