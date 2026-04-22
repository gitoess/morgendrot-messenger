'use client'

import { unishox2_decompress_simple } from 'unishox2.siara.cc'

function asUint8Payload(payload: unknown): Uint8Array | null {
  if (payload instanceof Uint8Array) return payload
  if (Array.isArray(payload) && payload.every((x) => typeof x === 'number')) {
    return new Uint8Array(payload as number[])
  }
  return null
}

/**
 * Meshtastic `TEXT_MESSAGE_COMPRESSED_APP` (Port 7, Unishox2).
 * `@meshtastic/core` 2.6.x feuert dafür kein `onMessagePacket` (switch `default` in `handleDecodedPacket`).
 * Dekodierung erfolgt deshalb im `onMeshPacket`-Pfad in `use-meshtastic-ble`.
 */
export function tryDecodeMeshtasticCompressedTextPayload(payload: unknown): string | null {
  const bytes = asUint8Payload(payload)
  if (!bytes || bytes.length === 0) return null
  try {
    const out = unishox2_decompress_simple(bytes, bytes.length) as string | null | undefined
    return typeof out === 'string' ? out : null
  } catch {
    return null
  }
}
