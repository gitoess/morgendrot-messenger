'use client'

import { useEffect, useMemo, useState } from 'react'
import { resolveActiveEinsatzChainMode } from '@/frontend/lib/einsatz-chain-mode-local'
import {
    EINSATZ_MANIFEST_ANCHOR_CHANGED,
    readAnchoredManifestEntryHashes,
} from '@/frontend/lib/einsatz-manifest-anchor-cache'
import {
    computeMessageManifestEntryHash,
    resolveEinsatzInboxMessageBadges,
    type EinsatzInboxMessageBadges,
} from '@/frontend/lib/einsatz-inbox-badges'
import { buildInboxMessageTxDigestMap } from '@/frontend/lib/einsatz-message-tx-digest'
import type { Message } from '@/frontend/lib/types'

const TANGLE_INVENTORY_LS = 'morgendrot.tangleInventory.v1'

export function useEinsatzInboxBadges(messages: readonly Message[]): {
    getBadgesForMessage: (msg: Message) => EinsatzInboxMessageBadges
    getTxDigestForMessage: (msg: Message) => string | undefined
    chainMode: ReturnType<typeof resolveActiveEinsatzChainMode>
} {
    const chainMode = resolveActiveEinsatzChainMode()
    const [anchoredHashes, setAnchoredHashes] = useState(() => readAnchoredManifestEntryHashes())
    const [entryHashById, setEntryHashById] = useState<Map<string, string>>(() => new Map())
    const [txDigestTick, setTxDigestTick] = useState(0)

    useEffect(() => {
        const refresh = () => setAnchoredHashes(readAnchoredManifestEntryHashes())
        const refreshDigests = (e: StorageEvent) => {
            if (!e.key || e.key === TANGLE_INVENTORY_LS) setTxDigestTick((n) => n + 1)
        }
        window.addEventListener(EINSATZ_MANIFEST_ANCHOR_CHANGED, refresh)
        window.addEventListener('storage', refresh)
        window.addEventListener('storage', refreshDigests)
        return () => {
            window.removeEventListener(EINSATZ_MANIFEST_ANCHOR_CHANGED, refresh)
            window.removeEventListener('storage', refresh)
            window.removeEventListener('storage', refreshDigests)
        }
    }, [])

    const messageIdsKey = useMemo(
        () => messages.map((m) => `${m.id}:${m.timestamp}:${(m.content ?? '').length}`).join('|'),
        [messages]
    )

    useEffect(() => {
        let cancelled = false
        void (async () => {
            const next = new Map<string, string>()
            for (const m of messages) {
                next.set(m.id, await computeMessageManifestEntryHash(m))
            }
            if (!cancelled) setEntryHashById(next)
        })()
        return () => {
            cancelled = true
        }
    }, [messageIdsKey, messages])

    const txDigestById = useMemo(() => {
        void txDigestTick
        return buildInboxMessageTxDigestMap(messages)
    }, [messageIdsKey, messages, txDigestTick])

    const getBadgesForMessage = useMemo(() => {
        return (msg: Message): EinsatzInboxMessageBadges =>
            resolveEinsatzInboxMessageBadges(
                msg,
                chainMode,
                entryHashById.get(msg.id),
                anchoredHashes
            )
    }, [anchoredHashes, chainMode, entryHashById])

    const getTxDigestForMessage = useMemo(() => {
        return (msg: Message): string | undefined => txDigestById.get(msg.id)
    }, [txDigestById])

    return { getBadgesForMessage, getTxDigestForMessage, chainMode }
}
