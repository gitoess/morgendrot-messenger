/**
 * Kanonischer Nachrichten-Hash für Posteingang (⋯ / Auswahl).
 * Nutzt dieselbe Kanonik wie Einsatz-Manifest (`entry_hash`), plus lesbare Meta-Zeilen.
 */

import type { Message } from '@/frontend/lib/types'
import {
  buildEinsatzManifestCanonicalMsgRef,
  buildEinsatzManifestEntryHash,
} from '@/frontend/lib/einsatz-manifest-v1'
import { sha256HexUtf8 } from '@/frontend/lib/einsatzprotokoll-anchor'

export type MessageCanonicalHashResult = {
  /** SHA-256 = Manifest entry_hash (ref|sender|timestamp|contentHash). */
  entryHash: string
  canonicalMsgRef: string
  contentSha256: string
  /** Mehrzeilig zum Kopieren / Prüfen. */
  clipboardText: string
}

function inferTransportLabel(m: Message): string {
  if (m.transports?.length) return m.transports.join('+')
  if (m.source === 'mesh') return 'mesh'
  if (m.source === 'telegram') return 'telegram'
  if (m.source === 'lan') return 'lan'
  return m.source ?? 'mailbox'
}

/**
 * Kern-Hash: Inhalt + Absender + Empfänger (über canonical_msg_ref) + Zeit.
 * Zusatz (Transport, Telegram-Meta) nur als Meta-Zeilen — nicht im Kern-Hash.
 */
export async function hashInboxMessageCanonical(m: Message): Promise<MessageCanonicalHashResult> {
  const content = m.content ?? ''
  const canonicalMsgRef = await buildEinsatzManifestCanonicalMsgRef(m)
  const contentSha256 = await sha256HexUtf8(content)
  const entryHash = await buildEinsatzManifestEntryHash({
    canonical_msg_ref: canonicalMsgRef,
    sender: m.from,
    timestamp_ms: m.timestamp,
    content,
  })
  const recipient = (m.recipient ?? '').trim() || '(kein Empfänger-Feld)'
  const iso = Number.isFinite(m.timestamp) ? new Date(m.timestamp).toISOString() : String(m.timestamp)
  const lines = [
    `entry_hash=${entryHash}`,
    `canonical_msg_ref=${canonicalMsgRef}`,
    `content_sha256=${contentSha256}`,
    `from=${m.from}`,
    `recipient=${recipient}`,
    `timestamp_ms=${m.timestamp}`,
    `timestamp_iso=${iso}`,
    `transport=${inferTransportLabel(m)}`,
  ]
  if (m.telegramMeta?.chatId) {
    lines.push(`telegram_chat_id=${m.telegramMeta.chatId}`)
    lines.push(`telegram_direction=${m.telegramMeta.direction}`)
  }
  if (m.chainTxDigest?.trim()) lines.push(`chain_tx_digest=${m.chainTxDigest.trim()}`)
  if (m.encrypted) lines.push('note=Inhalt wie gespeichert (Wire/versiegelt) — Unlock ändert den Hash')
  lines.push('schema=morgendrot-message-hash-v1')
  return {
    entryHash,
    canonicalMsgRef,
    contentSha256,
    clipboardText: lines.join('\n'),
  }
}

/** Mehrere Nachrichten: eine Blöcke-Liste (entry_hash je Zeile + Detailblock). */
export async function hashInboxMessagesCanonical(messages: readonly Message[]): Promise<{
  summaryLines: string
  clipboardText: string
  hashes: MessageCanonicalHashResult[]
}> {
  const hashes: MessageCanonicalHashResult[] = []
  for (const m of messages) {
    hashes.push(await hashInboxMessageCanonical(m))
  }
  const summaryLines = hashes.map((h, i) => `${i + 1}. ${h.entryHash}`).join('\n')
  const clipboardText = hashes
    .map((h, i) => `--- Nachricht ${i + 1} ---\n${h.clipboardText}`)
    .join('\n\n')
  return { summaryLines, clipboardText, hashes }
}
