'use client'

import { fetchMailboxInboxPage } from '@/frontend/lib/mailbox-inbox-page-fetch'
import {
  parseProtokollFullChunkWire,
  reassembleProtokollFullChunks,
  type ProtokollFullChunkPayload,
} from '@/frontend/lib/einsatzprotokoll-anchor-chunks'
import { sha256HexUtf8 } from '@/frontend/lib/einsatzprotokoll-anchor'

export type ProtokollChunkScanResult =
  | { ok: true; json: string; partsFound: number; partsExpected: number; contentSha256: string }
  | { ok: false; error: string; partsFound?: number; partsExpected?: number }

/** Sucht im Mailbox-Posteingang (RPC) nach allen Protokoll-Vollbericht-Chunks und setzt sie zusammen. */
export async function scanMailboxAndReassembleProtokollFull(opts?: {
  maxPages?: number
  pageSize?: number
}): Promise<ProtokollChunkScanResult> {
  const pageSize = opts?.pageSize ?? 200
  const maxPages = opts?.maxPages ?? 12
  const byHash = new Map<string, Map<number, ProtokollFullChunkPayload>>()

  for (let page = 0; page < maxPages; page++) {
    const r = await fetchMailboxInboxPage({ limit: pageSize, offset: page * pageSize })
    if (!r.ok) {
      return { ok: false, error: r.error || `RPC-Fehler (Seite ${page + 1}).` }
    }
    if (r.rows.length === 0) break
    for (const row of r.rows) {
      const parsed = parseProtokollFullChunkWire(String(row.text ?? ''))
      if (!parsed) continue
      let parts = byHash.get(parsed.h)
      if (!parts) {
        parts = new Map()
        byHash.set(parsed.h, parts)
      }
      parts.set(parsed.p, parsed)
    }
    if (r.rows.length < pageSize) break
  }

  if (byHash.size === 0) {
    return { ok: false, error: 'Keine Protokoll-Chunks (MORG_PROTOKOLL_FULL_CHUNK_V1) in der Mailbox gefunden.' }
  }

  let best: ProtokollFullChunkPayload[] | null = null
  for (const parts of byHash.values()) {
    const list = [...parts.values()].sort((a, b) => a.p - b.p)
    if (!best || list.length > best.length) best = list
  }
  if (!best?.length) {
    return { ok: false, error: 'Chunks gefunden, aber nicht zusammenfügbar.' }
  }

  const expected = best[0]!.t
  const assembled = reassembleProtokollFullChunks(best)
  if (!assembled.ok) {
    return {
      ok: false,
      error: assembled.error,
      partsFound: best.length,
      partsExpected: expected,
    }
  }

  const contentSha256 = best[0]!.h
  const actual = await sha256HexUtf8(assembled.json)
  if (actual !== contentSha256) {
    return {
      ok: false,
      error: 'Zusammengesetzter Bericht: SHA-256 stimmt nicht mit Chunk-Metadaten überein.',
      partsFound: best.length,
      partsExpected: expected,
    }
  }

  return {
    ok: true,
    json: assembled.json,
    partsFound: best.length,
    partsExpected: expected,
    contentSha256,
  }
}
