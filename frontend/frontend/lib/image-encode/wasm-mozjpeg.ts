/**
 * MozJPEG via WASM (`@jsquash/jpeg`) — nur Browser/Capacitor.
 */

let encodeModule: typeof import('@jsquash/jpeg') | null = null

async function loadEncode(): Promise<typeof import('@jsquash/jpeg')> {
  if (!encodeModule) {
    encodeModule = await import('@jsquash/jpeg')
  }
  return encodeModule
}

export async function encodeImageDataToJpeg(
  imageData: ImageData,
  quality: number
): Promise<Uint8Array> {
  const { encode } = await loadEncode()
  const q = Math.min(100, Math.max(1, Math.round(quality)))
  const buf = await encode(imageData, { quality: q })
  return new Uint8Array(buf)
}
