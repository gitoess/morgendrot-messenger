'use client'

import type { Message } from '@/frontend/lib/types'
import {
    computeCanonicalMsgRefV1,
    parseMailboxOutNonceMarker,
    stableOfflineMailboxThreadId,
} from '@morgendrot/core/queue/offline-mailbox'

const U64_MAX = BigInt('18446744073709551615')

function parseChainNonceToU64(raw: string | undefined): bigint | undefined {
    if (!raw?.trim()) return undefined
    const t = raw.trim()
    if (!/^\d+$/.test(t)) return undefined
    try {
        const n = BigInt(t)
        if (n < BigInt(0) || n > U64_MAX) return undefined
        return n
    } catch {
        return undefined
    }
}

/** § H.33 — kanonischer msg_ref (v1) aus Posteingang-Nachricht für Manifest + Abgleich. */
export async function buildEinsatzManifestCanonicalMsgRef(m: Message): Promise<string> {
    const sender = m.from.trim()
    const recipient = (m.recipient ?? m.from).trim()
    const wire = m.content ?? ''
    const parsed = parseMailboxOutNonceMarker(wire)
    const payloadUtf8 = parsed?.rest ?? wire
    const nonceFromWire = parsed?.nonce
    const nonceFromChain = parseChainNonceToU64(m.chainNonce)
    const messageNonceU64 = nonceFromWire ?? nonceFromChain
    return computeCanonicalMsgRefV1({
        senderAddress: sender,
        recipientAddress: recipient,
        threadId: stableOfflineMailboxThreadId(sender, recipient),
        ...(messageNonceU64 !== undefined ? { messageNonceU64 } : {}),
        payloadUtf8,
    })
}

/** @deprecated Nutze `buildEinsatzManifestCanonicalMsgRef` — Alias für Migration. */
export const buildCanonicalMsgRefPlaceholder = buildEinsatzManifestCanonicalMsgRef
