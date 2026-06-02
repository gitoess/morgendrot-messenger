'use client'

/**
 * Canvas-Hilfen für IOTA `MORG_COMPACT_IMG_V1` (Luma-WebP + Chroma-PNG).
 */

import { encodeImageDataToWebp } from '@/frontend/lib/image-encode/wasm-webp'
import { dataUrlToImageBitmap, scaleBitmapMaxDim } from '@/frontend/lib/image-encode/wasm-lora-canvas'

export { dataUrlToImageBitmap, scaleBitmapMaxDim }

function fitInsideSize(bmp: ImageBitmap, maxDim: number): { w: number; h: number } {
  if (bmp.width <= maxDim && bmp.height <= maxDim) return { w: bmp.width, h: bmp.height }
  const scale = Math.min(maxDim / bmp.width, maxDim / bmp.height)
  return {
    w: Math.max(1, Math.round(bmp.width * scale)),
    h: Math.max(1, Math.round(bmp.height * scale)),
  }
}

export async function encodeLumaWebpFromBitmap(
  bmp: ImageBitmap,
  maxDim: number,
  quality: number
): Promise<Uint8Array> {
  const { w, h } = fitInsideSize(bmp, maxDim)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar.')
  ctx.filter = 'grayscale(100%)'
  ctx.drawImage(bmp, 0, 0, w, h)
  ctx.filter = 'none'
  const imageData = ctx.getImageData(0, 0, w, h)
  return encodeImageDataToWebp(imageData, quality)
}

export async function encodeChromaPngFromBitmap(
  bmp: ImageBitmap,
  targetW: number,
  targetH: number
): Promise<Uint8Array> {
  const w = Math.max(1, targetW)
  const h = Math.max(1, targetH)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar.')
  const scale = Math.max(w / bmp.width, h / bmp.height)
  const sw = bmp.width * scale
  const sh = bmp.height * scale
  const x = (w - sw) / 2
  const y = (h - sh) / 2
  ctx.drawImage(bmp, x, y, sw, sh)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Chroma-PNG-Kodierung fehlgeschlagen.'))),
      'image/png'
    )
  })
  return new Uint8Array(await blob.arrayBuffer())
}

export async function sha256OfBlob(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return new Uint8Array(digest)
}
