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
import {
    buildEinsatzManifestCanonicalMsgRef,
} from '@/frontend/lib/einsatz-manifest-canonical-ref'
import { FORENSIC_BATCH_CHANGED } from '@/frontend/lib/forensic-batch-config'
import {
    buildInboxMessageTxDigestMap,
    resolveInboxMessageTxDigest,
} from '@/frontend/lib/einsatz-message-tx-digest'
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
    const [canonicalRefById, setCanonicalRefById] = useState<Map<string, string>>(() => new Map())
    const [registryTick, setRegistryTick] = useState(0)
    const [txDigestTick, setTxDigestTick] = useState(0)

    useEffect(() => {
        const refresh = () => setAnchoredHashes(readAnchoredManifestEntryHashes())
        const refreshDigests = (e: StorageEvent) => {
            if (!e.key || e.key === TANGLE_INVENTORY_LS) setTxDigestTick((n) => n + 1)
        }
        const refreshBatch = () => setRegistryTick((n) => n + 1)
        window.addEventListener(EINSATZ_MANIFEST_ANCHOR_CHANGED, refresh)
        window.addEventListener(FORENSIC_BATCH_CHANGED, refreshBatch)
        window.addEventListener('storage', refresh)
        window.addEventListener('storage', refreshDigests)
        return () => {
            window.removeEventListener(EINSATZ_MANIFEST_ANCHOR_CHANGED, refresh)
            window.removeEventListener(FORENSIC_BATCH_CHANGED, refreshBatch)
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
            const hashMap = new Map<string, string>()
            const refMap = new Map<string, string>()
            for (const m of messages) {
                hashMap.set(m.id, await computeMessageManifestEntryHash(m))
                refMap.set(m.id, await buildEinsatzManifestCanonicalMsgRef(m))
            }
            if (!cancelled) {
                setEntryHashById(hashMap)
                setCanonicalRefById(refMap)
            }
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
        void registryTick
        return (msg: Message): EinsatzInboxMessageBadges =>
            resolveEinsatzInboxMessageBadges(
                msg,
                chainMode,
                entryHashById.get(msg.id),
                anchoredHashes,
                canonicalRefById.get(msg.id)
            )
    }, [anchoredHashes, chainMode, entryHashById, canonicalRefById, registryTick])

    const getTxDigestForMessage = useMemo(() => {
        return (msg: Message): string | undefined =>
            txDigestById.get(msg.id) ?? resolveInboxMessageTxDigest(msg)
    }, [txDigestById])

    return { getBadgesForMessage, getTxDigestForMessage, chainMode }
}
