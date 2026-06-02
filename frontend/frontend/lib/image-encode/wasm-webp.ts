'use client'

/**
 * WebP via WASM (`@jsquash/webp`) — Luma-Schicht für `MORG_COMPACT_IMG_V1`.
 */

let encodeModule: typeof import('@jsquash/webp') | null = null

async function loadEncode(): Promise<typeof import('@jsquash/webp')> {
  if (!encodeModule) {
    encodeModule = await import('@jsquash/webp')
  }
  return encodeModule
}

export async function encodeImageDataToWebp(
  imageData: ImageData,
  quality: number
): Promise<Uint8Array> {
  const { encode } = await loadEncode()
  const q = Math.min(100, Math.max(1, Math.round(quality)))
  const out = await encode(imageData, { quality: q })
  return out instanceof Uint8Array ? out : new Uint8Array(out)
}
