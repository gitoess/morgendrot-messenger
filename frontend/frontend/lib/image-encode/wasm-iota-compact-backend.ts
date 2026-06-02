'use client'

/**
 * IOTA `MORG_COMPACT_IMG_V1` auf dem Gerät (Canvas + WebP WASM).
 */

import { encodeIotaCompactFitChain, MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES } from '@morgendrot/core/image'
import {
  type IotaCompactEncodeResult,
  type ImageEncodePort,
  iotaPackedToResult,
} from '@/frontend/lib/image-encode/image-encode-port'
import {
  dataUrlToImageBitmap,
  encodeChromaPngFromBitmap,
  encodeLumaWebpFromBitmap,
  scaleBitmapMaxDim,
  sha256OfBlob,
} from '@/frontend/lib/image-encode/wasm-iota-canvas'

export function createWasmIotaCompactEncoder(): Pick<ImageEncodePort, 'encodeIotaCompact'> {
  return {
    encodeIotaCompact: (dataUrl, opts) => encodeIotaCompactWasm(dataUrl, opts),
  }
}

async function encodeIotaCompactWasm(
  dataUrl: string,
  opts?: { maxPlaintextBytes?: number }
): Promise<IotaCompactEncodeResult> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return { ok: false, error: 'IOTA-Bild-Kodierung nur im Browser verfügbar.' }
  }

  let root: ImageBitmap | null = null
  let working: ImageBitmap | null = null

  const closeAll = () => {
    working?.close()
    root?.close()
    working = null
    root = null
  }

  try {
    const res = await fetch(dataUrl)
    if (!res.ok) throw new Error('Bild konnte nicht geladen werden.')
    const sourceBlob = await res.blob()
    const originalSha256 = await sha256OfBlob(sourceBlob)

    root = await dataUrlToImageBitmap(dataUrl)
    working = root

    const maxPlaintextBytes = opts?.maxPlaintextBytes ?? MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES

    const policy = await encodeIotaCompactFitChain(originalSha256, {
      encodeChroma: async (cw, ch) => {
        if (!root) return null
        try {
          return await encodeChromaPngFromBitmap(root, cw, ch)
        } catch {
          return null
        }
      },
      encodeLuma: async (dim, q) => {
        if (!root) return null
        try {
          if (working && working !== root) working.close()
          working = await scaleBitmapMaxDim(root, dim)
          return await encodeLumaWebpFromBitmap(working, dim, q)
        } catch {
          return null
        }
      },
    }, maxPlaintextBytes)

    if (!policy.ok) {
      return { ok: false, error: policy.error }
    }
    return iotaPackedToResult(policy.result, 'wasm')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    closeAll()
  }
}
