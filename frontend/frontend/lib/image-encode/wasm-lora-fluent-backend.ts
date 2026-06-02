'use client'

/**
 * § H.25a — Flüchtig-LoRa-Kodierung auf dem Gerät (Canvas + MozJPEG WASM).
 */

import {
  encodeLoraFluentRobustWithPolicy,
  type LoraFluentEncodeAttempt,
} from '@morgendrot/core/image'
import {
  dataUrlToImageBitmap,
  encodeChromaJpegFromBitmap,
  encodeLumaJpegFromBitmap,
  scaleBitmapMaxDim,
} from '@/frontend/lib/image-encode/wasm-lora-canvas'
import {
  type ImageEncodePort,
  type LoRaFluentEncodeResult,
  loraBundleToResult,
} from '@/frontend/lib/image-encode/image-encode-port'
import { createWasmIotaCompactEncoder } from '@/frontend/lib/image-encode/wasm-iota-compact-backend'

export function createWasmImageEncodePort(): ImageEncodePort {
  const iota = createWasmIotaCompactEncoder()
  return {
    id: 'wasm',
    encodeLoRaFluent: (dataUrl, opts) => encodeLoRaFluentWasm(dataUrl, opts),
    encodeIotaCompact: iota.encodeIotaCompact,
  }
}

async function encodeLoRaFluentWasm(
  dataUrl: string,
  opts?: { maxTotalBytes?: number }
): Promise<LoRaFluentEncodeResult> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return { ok: false, error: 'LoRa-Bild-Kodierung nur im Browser verfügbar.' }
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
    root = await dataUrlToImageBitmap(dataUrl)
    working = root

    const encodeAttempt = async (attempt: LoraFluentEncodeAttempt) => {
      if (!working) return null
      try {
        const luma = await encodeLumaJpegFromBitmap(working, attempt.lumaWidth, attempt.lumaQuality)
        const chroma = await encodeChromaJpegFromBitmap(
          working,
          attempt.chromaW,
          attempt.chromaH,
          attempt.chromaBlur,
          attempt.chromaQuality
        )
        return { luma, chroma }
      } catch {
        return null
      }
    }

    const policy = await encodeLoraFluentRobustWithPolicy({
      prepareSourceAtDim: async (dim) => {
        if (!root) return
        if (working && working !== root) working.close()
        working = await scaleBitmapMaxDim(root, dim)
      },
      encodeAttempt,
    }, opts)

    if (!policy.ok) {
      return { ok: false, error: policy.error }
    }
    return loraBundleToResult(policy.bundle, 'wasm')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    closeAll()
  }
}
