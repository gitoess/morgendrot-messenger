'use client'

/**
 * Einsatzprotokoll auf IOTA verankern: Hash (öffentlich /send-plain) oder Voll-JSON (verschlüsselt /send).
 */

import type { Message } from '@/frontend/lib/types'
import { nextOfflineMailboxClientOutSeq, prependMailboxOutNonceMarker } from '@/frontend/lib/api/offline-queue'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import {
  sendEncryptedMailboxHybrid,
  sendPlaintextMailboxHybrid,
} from '@/frontend/lib/mailbox-send-hybrid'
import { buildEinsatzprotokollPayload } from '@/frontend/lib/einsatzprotokoll-export'
import { MESSAGING_WIRE_UTF8_MAX } from '@/frontend/lib/compact-image-wire'
import {
  buildProtokollFullWireChunks,
  MORG_PROTOKOLL_FULL_CHUNK_MARKER,
} from '@/frontend/lib/einsatzprotokoll-anchor-chunks'

export const MORG_PROTOKOLL_ANCHOR_PREFIX = '[[MORG_PROTOKOLL_ANCHOR_V1:'
export const MORG_PROTOKOLL_ANCHOR_SUFFIX = ']]'

export type ProtokollAnchorScope =
  | { kind: 'all' }
  | { kind: 'ids'; ids: string[] }
  | { kind: 'range'; fromMs: number; toMs: number }

export function filterMessagesForAnchor(messages: readonly Message[], scope: ProtokollAnchorScope): Message[] {
  let list = [...messages]
  if (scope.kind === 'ids' && scope.ids.length > 0) {
    const s = new Set(scope.ids)
    list = list.filter((m) => s.has(m.id))
  } else if (scope.kind === 'range') {
    list = list.filter((m) => m.timestamp >= scope.fromMs && m.timestamp <= scope.toMs)
  }
  return list.sort((a, b) => a.timestamp - b.timestamp)
}

export function canonicalJsonForAnchorHash(messages: readonly Message[]): string {
  return JSON.stringify(
    messages.map((m) => ({
      id: m.id,
      from: m.from,
      timestamp: m.timestamp,
      content: m.content ?? '',
      transports: m.transports?.length
        ? m.transports
        : m.source === 'mesh'
          ? ['mesh']
          : ['internet'],
    }))
  )
}

export async function sha256HexUtf8(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  const a = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < a.length; i++) hex += a[i]!.toString(16).padStart(2, '0')
  return hex
}

export function buildAnchorHashWire(hex64: string, meta: { exportedAt: number; messageCount: number }): string {
  const core = `${MORG_PROTOKOLL_ANCHOR_PREFIX}${hex64}${MORG_PROTOKOLL_ANCHOR_SUFFIX}`
  const line = `\n\nmorgendrot.einsatzprotokoll.anchor.meta.v1 ${JSON.stringify(meta)}`
  return core + line
}

export type AnchorOnChainRecord = {
  digest?: string
  nonce?: string
  chunkPart?: number
  chunkTotal?: number
}

export type AnchorOnChainResult =
  | {
      ok: true
      txDigest?: string
      txDigests?: string[]
      chunksSent?: number
      contentSha256?: string
      anchorHashHex?: string
      records?: AnchorOnChainRecord[]
    }
  | { ok: false; error: string; chunksSent?: number }

/** Variante A: Klartext auf Chain (Explorer). Variante B: vollständiges JSON verschlüsselt /send. */
export async function anchorEinsatzprotokollOnIota(p: {
  variant: 'hash' | 'full'
  messages: readonly Message[]
  scope: ProtokollAnchorScope
  exportedByAddress?: string
  /** Für Hash-Variante: Empfänger der /send-plain-Transaktion (z. B. eigene 0x…). */
  recipientForPlain: string
  messagingPersistenceMode?: MessagingPersistenceMode
  onProgress?: (msg: string) => void
}): Promise<AnchorOnChainResult> {
  const persist = p.messagingPersistenceMode
  const selected = filterMessagesForAnchor(p.messages, p.scope)
  if (selected.length === 0) {
    return { ok: false, error: 'Keine Nachrichten für die gewählte Auswahl.' }
  }

  if (p.variant === 'hash') {
    const canon = canonicalJsonForAnchorHash(selected)
    const hex = await sha256HexUtf8(canon)
    const wire = buildAnchorHashWire(hex, {
      exportedAt: Date.now(),
      messageCount: selected.length,
    })
    const u8 = new TextEncoder().encode(wire)
    if (u8.length > MESSAGING_WIRE_UTF8_MAX) {
      return { ok: false, error: `Anker-Wire zu lang (${u8.length} B UTF-8).` }
    }
    const nonceU64 = BigInt(nextOfflineMailboxClientOutSeq())
    const wireOut = prependMailboxOutNonceMarker(wire, nonceU64)
    const r = await sendPlaintextMailboxHybrid(p.recipientForPlain.trim(), wireOut, nonceU64, {
      messagingPersistenceMode: persist,
    })
    if (!r.ok) {
      return { ok: false, error: r.error || r.message || 'send-plain fehlgeschlagen' }
    }
    const nonceStr = r.nonce ?? nonceU64.toString()
    return {
      ok: true,
      txDigest: r.txDigest,
      anchorHashHex: hex,
      records: [{ digest: r.txDigest, nonce: nonceStr }],
    }
  }

  const recipient = p.recipientForPlain.trim()
  if (!recipient) {
    return { ok: false, error: 'Für Vollbericht: Empfänger-Adresse setzen (oder eigene Adresse).' }
  }

  const payload = buildEinsatzprotokollPayload(selected, { exportedByAddress: p.exportedByAddress })
  const json = JSON.stringify(payload)
  const contentSha256 = await sha256HexUtf8(json)
  const n = new TextEncoder().encode(json).length

  if (n <= MESSAGING_WIRE_UTF8_MAX) {
    p.onProgress?.('Vollbericht: eine Transaktion…')
    const nonceU64 = BigInt(nextOfflineMailboxClientOutSeq())
    const body = prependMailboxOutNonceMarker(json, nonceU64)
    const r = await sendEncryptedMailboxHybrid(recipient, body, { messagingPersistenceMode: persist })
    if (!r.ok) {
      return { ok: false, error: r.error || r.message || '/send fehlgeschlagen' }
    }
    const nonceStr = r.nonce ?? nonceU64.toString()
    return {
      ok: true,
      txDigest: r.txDigest,
      chunksSent: 1,
      contentSha256,
      records: [{ digest: r.txDigest, nonce: nonceStr }],
    }
  }

  let wires: string[]
  try {
    wires = buildProtokollFullWireChunks(json, contentSha256)
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }

  p.onProgress?.(`Vollbericht: ${wires.length} Teile (${n} B)…`)
  const txDigests: string[] = []
  const records: AnchorOnChainRecord[] = []
  for (let i = 0; i < wires.length; i++) {
    p.onProgress?.(`Teil ${i + 1}/${wires.length} senden…`)
    const nonceU64 = BigInt(nextOfflineMailboxClientOutSeq())
    const body = prependMailboxOutNonceMarker(wires[i]!, nonceU64)
    const r = await sendEncryptedMailboxHybrid(recipient, body, { messagingPersistenceMode: persist })
    if (!r.ok) {
      return {
        ok: false,
        error: r.error || r.message || `Teil ${i + 1}/${wires.length}: /send fehlgeschlagen`,
        chunksSent: txDigests.length,
      }
    }
    if (r.txDigest) txDigests.push(r.txDigest)
    records.push({
      digest: r.txDigest,
      nonce: r.nonce ?? nonceU64.toString(),
      chunkPart: i + 1,
      chunkTotal: wires.length,
    })
  }
  return {
    ok: true,
    txDigest: txDigests[txDigests.length - 1],
    txDigests,
    chunksSent: wires.length,
    contentSha256,
    records,
  }
}

export { MORG_PROTOKOLL_FULL_CHUNK_MARKER }
