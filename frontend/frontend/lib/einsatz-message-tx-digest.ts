'use client'

import type { Message } from '@/frontend/lib/types'
import { isTangleInventoryUserMessage, loadTangleInventory } from '@/frontend/lib/tangle-inventory'

/** Lokaler Digest aus Message-Feld oder Tangle-Inventar (gesendete / gespiegelte Mailbox-TXs). */
export function resolveInboxMessageTxDigest(msg: Message): string | undefined {
    const fromField = msg.chainTxDigest?.trim()
    if (fromField) return fromField
    const nonce = msg.chainNonce?.trim()
    if (!nonce) return undefined
    const matches = loadTangleInventory()
        .filter(isTangleInventoryUserMessage)
        .filter((i) => (i.nonce ?? '').trim() === nonce)
    if (matches.length === 0) return undefined
    if (matches.length === 1) return matches[0]!.digest.trim() || undefined
    let best = matches[0]!
    let bestDelta = Math.abs(best.timestamp - msg.timestamp)
    for (const candidate of matches.slice(1)) {
        const delta = Math.abs(candidate.timestamp - msg.timestamp)
        if (delta < bestDelta) {
            best = candidate
            bestDelta = delta
        }
    }
    return best.digest.trim() || undefined
}

export function buildInboxMessageTxDigestMap(messages: readonly Message[]): Map<string, string> {
    const out = new Map<string, string>()
    for (const m of messages) {
        const digest = resolveInboxMessageTxDigest(m)
        if (digest) out.set(m.id, digest)
    }
    return out
}
