/**
 * Morgendrot S-ARQ — Parser für `MORG_SEG_V1` / `MORG_NAK_V1` (Gegenstück zu `lora-sarq-wire.ts`).
 */

import { normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'
import { crc16CcittFalse } from '@/frontend/lib/lora-sarq-wire'
import { base64ToUint8Array } from '@/frontend/lib/emergency-binary-browser'
import { messageLooksLikePath4ImageInitWire } from '@/frontend/lib/path4-image-transfer'

export const MORG_SEG_V1_PREFIX = '[[MORG_SEG_V1:' as const

/** Schneller Filter für Inbox/Chat (kein CRC-Decode). */
export function messageLooksLikeMorgSegV1Wire(content: string): boolean {
  return normalizeMessengerWireContent(content).startsWith(MORG_SEG_V1_PREFIX)
}

/** Pfad-4-Bild: S-ARQ-Segment oder optionaler IMG_INIT (§ H.25a). */
export function messageLooksLikePath4ImageTransferWire(content: string): boolean {
  return messageLooksLikeMorgSegV1Wire(content) || messageLooksLikePath4ImageInitWire(content)
}
export const MORG_NAK_V1_PREFIX = '[[MORG_NAK_V1:' as const

export type ParsedMorgSegV1 = {
  msgId: string
  phase: 'luma' | 'chroma'
  seg: number
  n: number
  /** Dekodierte Rohbytes dieses Segments (CRC über genau diese Bytes). */
  raw: Uint8Array
  /** Aus dem Wire gelesener CRC16-Wert (0..0xffff). */
  wireCrc16: number
}

export type ParsedMorgNakV1 = {
  msgId: string
  phase: 'luma' | 'chroma'
  /** Fehlende Segmentindizes: Bit _i_ = 1. */
  mask: number
}

/**
 * Parst ein vollständiges `MORG_SEG_V1`-Wire. `null` bei Truncation, falschem Format oder CRC-Widerspruch.
 */
export function parseMorgSegV1Message(content: string): ParsedMorgSegV1 | null {
  const t = normalizeMessengerWireContent(content)
  if (!t.startsWith(MORG_SEG_V1_PREFIX)) return null
  const s = t.slice(MORG_SEG_V1_PREFIX.length)
  const re =
    /^msgId=([a-f0-9]{8})\|phase=(luma|chroma)\|seg=(\d+)\|n=(\d+)\|len=(\d+)\|/
  const m = re.exec(s)
  if (!m) return null
  const msgId = m[1]!.toLowerCase()
  const phase = m[2] as 'luma' | 'chroma'
  const seg = parseInt(m[3]!, 10)
  const n = parseInt(m[4]!, 10)
  const len = parseInt(m[5]!, 10)
  if (!Number.isFinite(seg) || seg < 0 || seg > 1_000_000) return null
  if (!Number.isFinite(n) || n < 1 || n > 32) return null
  if (!Number.isFinite(len) || len < 0 || len > 2_000_000) return null

  const hdrEnd = MORG_SEG_V1_PREFIX.length + m[0].length
  if (t.length < hdrEnd + len + '|crc='.length + 4 + ']]'.length) return null

  const payload = t.slice(hdrEnd, hdrEnd + len)
  if (payload.length !== len) return null

  const tail = t.slice(hdrEnd + len)
  if (!tail.startsWith('|crc=')) return null
  const crcHex = tail.slice(5, 9)
  if (!/^[a-fA-F0-9]{4}$/.test(crcHex)) return null
  if (tail.slice(9, 11) !== ']]') return null
  if (tail.length > 11) return null

  const wireCrc16 = parseInt(crcHex, 16)
  if (!Number.isFinite(wireCrc16) || wireCrc16 < 0 || wireCrc16 > 0xffff) return null

  let raw: Uint8Array
  try {
    raw = base64ToUint8Array(payload.replace(/\s/g, ''))
  } catch {
    return null
  }

  if ((crc16CcittFalse(raw) & 0xffff) !== wireCrc16) return null
  if (seg >= n) return null

  return { msgId, phase, seg, n, raw, wireCrc16 }
}

/** Parst `MORG_NAK_V1` (8 Hex-Ziffern Maske). */
export function parseMorgNakV1Message(content: string): ParsedMorgNakV1 | null {
  const t = normalizeMessengerWireContent(content)
  if (!t.startsWith(MORG_NAK_V1_PREFIX)) return null
  const s = t.slice(MORG_NAK_V1_PREFIX.length)
  const re = /^msgId=([a-f0-9]{8})\|phase=(luma|chroma)\|mask=([a-fA-F0-9]{8})\]\]$/
  const m = re.exec(s)
  if (!m) return null
  const msgId = m[1]!.toLowerCase()
  const phase = m[2] as 'luma' | 'chroma'
  const mask = parseInt(m[3]!, 16)
  if (!Number.isFinite(mask) || mask < 0 || mask > 0xffff_ffff) return null
  return { msgId, phase, mask: mask >>> 0 }
}
