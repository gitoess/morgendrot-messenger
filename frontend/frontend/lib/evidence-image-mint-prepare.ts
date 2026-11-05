'use client'

/**
 * Mint-Bilder wie Chat-Anhänge auf dem Gerät verkleinern (Canvas + MozJPEG),
 * bevor image_data on-chain geht. Zielgröße unter dem Evidenz-Cap, gas-freundlich.
 */

import { encodeImageDataToJpeg } from '@/frontend/lib/image-encode/wasm-mozjpeg'
import { dataUrlToImageBitmap } from '@/frontend/lib/image-encode/wasm-lora-canvas'
import { EVIDENCE_IMAGE_MAX_RAW_BYTES } from '@/frontend/lib/evidence-onchain-image'

/** Soft-Ziel wie IOTA-Nachrichten (~12 KB); darunter wird nicht neu kodiert. */
export const EVIDENCE_MINT_TARGET_BYTES = 12_000

const MAX_DIMS = [1280, 960, 720, 540, 420, 320] as const
const QUALITIES = [82, 72, 62, 52, 42, 32] as const

export type PrepareEvidenceMintImageResult = {
  bytes: Uint8Array
  contentType: string
  /** true wenn verkleinert/neu kodiert */
  resized: boolean
  originalBytes: number
}

function bytesToDataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${contentType || 'application/octet-stream'};base64,${btoa(binary)}`
}

async function encodeFit(
  bmp: ImageBitmap,
  maxDim: number,
  quality: number
): Promise<Uint8Array> {
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height, 1))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar.')
  ctx.drawImage(bmp, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  return encodeImageDataToJpeg(imageData, quality)
}

/**
 * Wenn Rohbytes schon ≤ Ziel → unverändert.
 * Sonst JPEG-Fit (Dim × Qualität) bis ≤ Ziel oder hartem Evidenz-Cap.
 */
export async function prepareEvidenceImageForMint(
  plainBytes: Uint8Array,
  contentType: string,
  targetBytes: number = EVIDENCE_MINT_TARGET_BYTES
): Promise<PrepareEvidenceMintImageResult> {
  const originalBytes = plainBytes.length
  const ct = (contentType || 'image/jpeg').toLowerCase()
  if (!plainBytes.length) {
    return { bytes: plainBytes, contentType: ct, resized: false, originalBytes }
  }
  if (originalBytes <= targetBytes) {
    return { bytes: plainBytes, contentType: ct || 'image/jpeg', resized: false, originalBytes }
  }

  const dataUrl = bytesToDataUrl(plainBytes, ct.startsWith('image/') ? ct : 'image/jpeg')
  const bmp = await dataUrlToImageBitmap(dataUrl)
  try {
    let best: Uint8Array | null = null
    for (const dim of MAX_DIMS) {
      for (const q of QUALITIES) {
        const enc = await encodeFit(bmp, dim, q)
        if (!best || enc.length < best.length) best = enc
        if (enc.length <= targetBytes) {
          return {
            bytes: enc,
            contentType: 'image/jpeg',
            resized: true,
            originalBytes,
          }
        }
      }
    }
    if (best && best.length <= EVIDENCE_IMAGE_MAX_RAW_BYTES) {
      return {
        bytes: best,
        contentType: 'image/jpeg',
        resized: true,
        originalBytes,
      }
    }
    throw new Error(
      `Bild nach Verkleinerung noch zu groß (${best?.length ?? originalBytes} B, max. ${EVIDENCE_IMAGE_MAX_RAW_BYTES} B).`
    )
  } finally {
    bmp.close()
  }
}

/** Gas-Budget für ImageNFT-Mint (Storage von vector<u8>). 40M war für ~8 KB zu knapp. */
export function estimateImageNftMintGasBudget(imageBytes: number): bigint {
  const n = Math.max(0, Math.floor(imageBytes))
  const est = 150_000_000 + n * 5_000
  return BigInt(Math.min(1_000_000_000, Math.max(200_000_000, est)))
}
