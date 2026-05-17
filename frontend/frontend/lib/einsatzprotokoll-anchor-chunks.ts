'use client'

/**
 * Vollbericht > Wire-Limit: JSON in mehrere verschlüsselte Mailbox-Nachrichten splitten.
 * Wire: [[MORG_PROTOKOLL_FULL_CHUNK_V1]]{"p":1,"t":5,"h":"<sha256>","d":"<base64>"}
 */

import { MESSAGING_WIRE_UTF8_MAX, wireUtf8ByteLength } from '@/frontend/lib/compact-image-wire'

export const MORG_PROTOKOLL_FULL_CHUNK_MARKER = '[[MORG_PROTOKOLL_FULL_CHUNK_V1]]'

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export type ProtokollFullChunkPayload = {
  p: number
  t: number
  h: string
  d: string
}

export function wrapProtokollFullChunkWire(payload: ProtokollFullChunkPayload): string {
  return `${MORG_PROTOKOLL_FULL_CHUNK_MARKER}${JSON.stringify(payload)}`
}

export function parseProtokollFullChunkWire(text: string): ProtokollFullChunkPayload | null {
  const s = String(text ?? '').trim()
  if (!s.startsWith(MORG_PROTOKOLL_FULL_CHUNK_MARKER)) return null
  try {
    const raw = JSON.parse(s.slice(MORG_PROTOKOLL_FULL_CHUNK_MARKER.length)) as unknown
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const p = Number(o.p)
    const t = Number(o.t)
    const h = typeof o.h === 'string' ? o.h : ''
    const d = typeof o.d === 'string' ? o.d : ''
    if (!Number.isFinite(p) || !Number.isFinite(t) || p < 1 || t < 1 || p > t || !h || !d) return null
    return { p, t, h, d }
  } catch {
    return null
  }
}

/** Zielgröße Rohtext pro Teil (Base64 wächst ~4/3; Reserve für JSON-Hülle). */
const CHUNK_RAW_MAX_CHARS = 9_000

export function buildProtokollFullWireChunks(jsonUtf8: string, contentSha256Hex: string): string[] {
  const h = contentSha256Hex.trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(h)) {
    throw new Error('Ungültiger SHA-256 für Protokoll-Chunks.')
  }
  let maxChars = CHUNK_RAW_MAX_CHARS
  for (let attempt = 0; attempt < 20; attempt++) {
    const slices: string[] = []
    if (jsonUtf8.length === 0) slices.push('')
    else {
      for (let i = 0; i < jsonUtf8.length; i += maxChars) {
        slices.push(jsonUtf8.slice(i, i + maxChars))
      }
    }
    const total = Math.max(1, slices.length)
    const wires = slices.map((slice, idx) => {
      const b64 = utf8ToBase64(slice)
      return wrapProtokollFullChunkWire({ p: idx + 1, t: total, h, d: b64 })
    })
    const over = wires.find((w) => wireUtf8ByteLength(w) > MESSAGING_WIRE_UTF8_MAX)
    if (!over) return wires
    maxChars = Math.max(512, Math.floor(maxChars / 2))
  }
  throw new Error(
    `Vollbericht-Chunks passen nicht unter ${MESSAGING_WIRE_UTF8_MAX} Byte UTF-8 pro Transaktion.`
  )
}

export function reassembleProtokollFullChunks(
  parts: readonly ProtokollFullChunkPayload[]
): { ok: true; json: string } | { ok: false; error: string } {
  if (parts.length === 0) return { ok: false, error: 'Keine Chunks.' }
  const h = parts[0]!.h
  const t = parts[0]!.t
  if (!parts.every((x) => x.h === h && x.t === t)) {
    return { ok: false, error: 'Chunk-Sätze haben unterschiedliche Hash- oder Teilanzahl.' }
  }
  const byPart = new Map<number, string>()
  for (const p of parts) {
    if (byPart.has(p.p)) return { ok: false, error: `Doppelter Teil ${p.p}.` }
    byPart.set(p.p, p.d)
  }
  if (byPart.size !== t) {
    return { ok: false, error: `Unvollständig: ${byPart.size}/${t} Teile.` }
  }
  let json = ''
  for (let i = 1; i <= t; i++) {
    const b64 = byPart.get(i)
    if (!b64) return { ok: false, error: `Teil ${i} fehlt.` }
    try {
      json += base64ToUtf8(b64)
    } catch {
      return { ok: false, error: `Teil ${i}: Base64 ungültig.` }
    }
  }
  return { ok: true, json }
}
