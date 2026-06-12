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
import type { Message } from '@/frontend/lib/types'

export function useEinsatzInboxBadges(messages: readonly Message[]): {
    getBadgesForMessage: (msg: Message) => EinsatzInboxMessageBadges
} {
    const chainMode = resolveActiveEinsatzChainMode()
    const [anchoredHashes, setAnchoredHashes] = useState(() => readAnchoredManifestEntryHashes())
    const [entryHashById, setEntryHashById] = useState<Map<string, string>>(() => new Map())

    useEffect(() => {
        const refresh = () => setAnchoredHashes(readAnchoredManifestEntryHashes())
        window.addEventListener(EINSATZ_MANIFEST_ANCHOR_CHANGED, refresh)
        window.addEventListener('storage', refresh)
        return () => {
            window.removeEventListener(EINSATZ_MANIFEST_ANCHOR_CHANGED, refresh)
            window.removeEventListener('storage', refresh)
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

    const getBadgesForMessage = useMemo(() => {
        return (msg: Message): EinsatzInboxMessageBadges =>
            resolveEinsatzInboxMessageBadges(
                msg,
                chainMode,
                entryHashById.get(msg.id),
                anchoredHashes
            )
    }, [anchoredHashes, chainMode, entryHashById])

    return { getBadgesForMessage }
}
