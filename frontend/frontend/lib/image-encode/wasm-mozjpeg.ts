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

export type EncodeJpegOpts = {
  /** Luma S/W: GRAYSCALE spart Bytes vs. YCbCr bei gleicher Schärfe. */
  grayscale?: boolean
}

export async function encodeImageDataToJpeg(
  imageData: ImageData,
  quality: number,
  opts?: EncodeJpegOpts
): Promise<Uint8Array> {
  const { encode } = await loadEncode()
  const q = Math.min(100, Math.max(1, Math.round(quality)))
  /** Trellis + optimize: bessere Rate-Distortion bei gleichem Cap (TX unverändert). */
  const buf = await encode(imageData, {
    quality: q,
    progressive: true,
    optimize_coding: true,
    baseline: false,
    smoothing: 0,
    trellis_multipass: true,
    trellis_opt_zero: true,
    trellis_opt_table: true,
    trellis_loops: 2,
    ...(opts?.grayscale
      ? {
          color_space: 1 as const, // MozJpegColorSpace.GRAYSCALE
          auto_subsample: false,
          separate_chroma_quality: false,
        }
      : {}),
  })
  return new Uint8Array(buf)
}
