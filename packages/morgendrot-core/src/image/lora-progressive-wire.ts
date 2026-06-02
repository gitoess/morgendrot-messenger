/**
 * LoRa progressive Wire-Helfer (Browser + Node) — LUMA/CHROMA JPEG in Text-Wires.
 */

export const MORG_LUMA_V1_PREFIX = '[[MORG_LUMA_V1:' as const
export const MORG_CHROMA_V1_PREFIX = '[[MORG_CHROMA_V1:' as const

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'undefined') {
    throw new Error('uint8ArrayToBase64: nur im Browser verfügbar.')
  }
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function newLoraMessageId(): string {
  const b = new Uint8Array(4)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(b)
  } else {
    for (let i = 0; i < 4; i++) b[i] = (Math.random() * 256) | 0
  }
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export function buildLoraLumaWire(messageId: string, jpeg: Uint8Array): string {
  const b64 = uint8ArrayToBase64(jpeg)
  return `${MORG_LUMA_V1_PREFIX}msgId=${messageId}|len=${b64.length}|${b64}]]`
}

export function buildLoraChromaWire(messageId: string, jpeg: Uint8Array): string {
  const b64 = uint8ArrayToBase64(jpeg)
  return `${MORG_CHROMA_V1_PREFIX}msgId=${messageId}|len=${b64.length}|${b64}]]`
}

export type LoraProgressiveWireBundle = {
  messageId: string
  lumaWire: string
  chromaWire: string
  lumaJpegBytes: number
  chromaJpegBytes: number
}

export function bundleLoraProgressiveWires(
  messageId: string,
  luma: Uint8Array,
  chroma: Uint8Array
): LoraProgressiveWireBundle {
  const lumaWire = buildLoraLumaWire(messageId, luma)
  const chromaWire = buildLoraChromaWire(messageId, chroma)
  return {
    messageId,
    lumaWire,
    chromaWire,
    lumaJpegBytes: luma.length,
    chromaJpegBytes: chroma.length,
  }
}
