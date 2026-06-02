/**
 * § H.25a / Pfad 4 — Bildtransfer über Meshtastic (Klartext).
 *
 * Produkt-Wire: `MORG_SEG_V1` + `MORG_NAK_V1` (S-ARQ). Optional `MORG_IMG_INIT_V1`
 * entspricht Roadmap **IMG_INIT** (transferId=msgId, part=phase, chunkTotal=n).
 *
 * @see docs/LORA-MORGENDROT-S-ARQ-SPEC.md
 * @see docs/ROADMAP-FAHRPLAN.md § H.25a
 */

import { normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'
import { crc16CcittFalse } from '@/frontend/lib/lora-sarq-wire'

export const MORG_IMG_INIT_V1_PREFIX = '[[MORG_IMG_INIT_V1:' as const

export type Path4ImagePhase = 'luma' | 'chroma'

export type ParsedPath4ImageInit = {
  msgId: string
  phase: Path4ImagePhase
  /** chunkTotal / n */
  n: number
  /** Optional CRC16 über vollständiges Phase-JPEG (hex 4). */
  imageHashCrc16?: number
}

export function buildPath4ImageInitWire(p: {
  msgId: string
  phase: Path4ImagePhase
  n: number
  jpeg?: Uint8Array
}): string {
  const msgId = p.msgId.trim().toLowerCase()
  if (!/^[a-f0-9]{8}$/.test(msgId)) {
    throw new Error('msgId: 8 hex Zeichen.')
  }
  const n = p.n
  if (!Number.isInteger(n) || n < 1 || n > 32) {
    throw new Error('n: 1..32 Segmente.')
  }
  let tail = ''
  if (p.jpeg && p.jpeg.length > 0) {
    const h = (crc16CcittFalse(p.jpeg) & 0xffff).toString(16).padStart(4, '0')
    tail = `|hash=${h}`
  }
  return `${MORG_IMG_INIT_V1_PREFIX}msgId=${msgId}|phase=${p.phase}|n=${n}${tail}]]`
}

export function messageLooksLikePath4ImageInitWire(content: string): boolean {
  return normalizeMessengerWireContent(content).startsWith(MORG_IMG_INIT_V1_PREFIX)
}

export function parsePath4ImageInitMessage(content: string): ParsedPath4ImageInit | null {
  const t = normalizeMessengerWireContent(content)
  if (!t.startsWith(MORG_IMG_INIT_V1_PREFIX)) return null
  const s = t.slice(MORG_IMG_INIT_V1_PREFIX.length)
  const re = /^msgId=([a-f0-9]{8})\|phase=(luma|chroma)\|n=(\d+)(?:\|hash=([a-fA-F0-9]{4}))?\]\]$/
  const m = re.exec(s)
  if (!m) return null
  const n = parseInt(m[3]!, 10)
  if (!Number.isFinite(n) || n < 1 || n > 32) return null
  const hash = m[4] ? parseInt(m[4], 16) : undefined
  return {
    msgId: m[1]!.toLowerCase(),
    phase: m[2] as Path4ImagePhase,
    n,
    ...(hash !== undefined && Number.isFinite(hash) ? { imageHashCrc16: hash & 0xffff } : {}),
  }
}

/** Inbox-Kollaps: gleiche Session wie `MORG_SEG_V1`. */
export function path4ImageSessionInboxKey(from: string, msgId: string, phase: Path4ImagePhase, n: number): string {
  return `${from.trim().toLowerCase()}:${msgId.toLowerCase()}:${phase}:${n}`
}

export function path4ImageInitInboxGroupKey(m: { from?: string; content?: string }): string | null {
  const init = parsePath4ImageInitMessage(m.content ?? '')
  if (!init) return null
  const f = (m.from ?? '').trim().toLowerCase()
  if (!f) return null
  return path4ImageSessionInboxKey(f, init.msgId, init.phase, init.n)
}
