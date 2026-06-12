'use client'

import { resolveInboxMessageTxDigest } from '@/frontend/lib/einsatz-message-tx-digest'
import type { Message } from '@/frontend/lib/types'

/** § H.33 — Tangle-Inventar-Digest an Message hängen (Explorer + Manifest). */
export function enrichInboxMessagesWithChainDigests(messages: readonly Message[]): Message[] {
  return messages.map((m) => {
    const digest = resolveInboxMessageTxDigest(m)
    if (!digest || m.chainTxDigest === digest) return m
    return { ...m, chainTxDigest: digest }
  })
}
