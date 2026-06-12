'use client'

import {
    einsatzChainModeShowsManifestAnchorUi,
    type EinsatzChainMode,
} from '@morgendrot/shared/einsatz-chain-mode'
import {
    buildCanonicalMsgRefPlaceholder,
    buildEinsatzManifestEntryHash,
} from '@/frontend/lib/einsatz-manifest-v1'
import type { Message } from '@/frontend/lib/types'

export type EinsatzInboxMessageBadges = {
    inEinsatzAnchor: boolean
    onChainMainnet: boolean
}

export async function computeMessageManifestEntryHash(message: Message): Promise<string> {
    const canonical_msg_ref = await buildCanonicalMsgRefPlaceholder(message)
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

export function resolveEinsatzInboxMessageBadges(
    message: Message,
    chainMode: EinsatzChainMode,
    entryHash: string | undefined,
    anchoredHashes: ReadonlySet<string>
): EinsatzInboxMessageBadges {
    return {
        inEinsatzAnchor: isMessageInEinsatzAnchor(entryHash, anchoredHashes, chainMode),
        onChainMainnet: isMessageOnChainMainnet(message, chainMode),
    }
}

export function einsatzInboxBadgesVisible(badges: EinsatzInboxMessageBadges): boolean {
    return badges.inEinsatzAnchor || badges.onChainMainnet
}
