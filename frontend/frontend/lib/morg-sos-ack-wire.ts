'use client'

/**
 * Mesh-SOS-Ack-Wire — Präfix mit `MorgTextWireMarker.SOS_ACK_V1` in `src/shared/opcodes.ts` synchron halten.
 */
const SOS_ACK_PREFIX = '[[MORG_SOS_ACK_V1:' as const
const CLOSE = ']]' as const

export type MorgSosAckV1Envelope = { v: 1; d: string; ts: number }

export function buildMorgSosAckV1Wire(digestSha256Hex64: string): string {
  const env: MorgSosAckV1Envelope = { v: 1, d: digestSha256Hex64.toLowerCase(), ts: Date.now() }
  return `${SOS_ACK_PREFIX}${JSON.stringify(env)}${CLOSE}`
}

export function tryParseMorgSosAckV1Plaintext(plaintext: string): string | null {
  if (!plaintext.startsWith(SOS_ACK_PREFIX)) return null
  const closeIdx = plaintext.indexOf(CLOSE, SOS_ACK_PREFIX.length)
  if (closeIdx < 0) return null
  const jsonStr = plaintext.slice(SOS_ACK_PREFIX.length, closeIdx)
  try {
    const o = JSON.parse(jsonStr) as MorgSosAckV1Envelope
    if (o?.v !== 1 || typeof o.d !== 'string') return null
    const d = o.d.toLowerCase().trim()
    if (!/^[a-f0-9]{64}$/.test(d)) return null
    return d
  } catch {
    return null
  }
}

export function plaintextStartsWithMorgSosAckV1(plaintext: string): boolean {
  return plaintext.startsWith(SOS_ACK_PREFIX)
}
