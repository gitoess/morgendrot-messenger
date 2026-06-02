/**
 * Canvas-Hilfen für Flüchtig-LoRa (Luma greyscale + Chroma cover), ohne Server.
 */

import { encodeImageDataToJpeg } from '@/frontend/lib/image-encode/wasm-mozjpeg'

export async function dataUrlToImageBitmap(dataUrl: string): Promise<ImageBitmap> {
  const res = await fetch(dataUrl)
  if (!res.ok) throw new Error('Bild konnte nicht geladen werden.')
  const blob = await res.blob()
  return createImageBitmap(blob)
}

export async function scaleBitmapMaxDim(bmp: ImageBitmap, maxDim: number): Promise<ImageBitmap> {
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height, 1))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar.')
  ctx.drawImage(bmp, 0, 0, w, h)
  return createImageBitmap(canvas)
}

function fitInsideSize(bmp: ImageBitmap, maxWidth: number): { w: number; h: number } {
  if (bmp.width <= maxWidth) return { w: bmp.width, h: bmp.height }
  const h = Math.max(1, Math.round((bmp.height * maxWidth) / bmp.width))
  return { w: maxWidth, h }
}

export async function encodeLumaJpegFromBitmap(
  bmp: ImageBitmap,
  maxWidth: number,
  quality: number
): Promise<Uint8Array> {
  const { w, h } = fitInsideSize(bmp, maxWidth)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar.')
  ctx.filter = 'grayscale(100%)'
  ctx.drawImage(bmp, 0, 0, w, h)
  ctx.filter = 'none'
  const imageData = ctx.getImageData(0, 0, w, h)
  return encodeImageDataToJpeg(imageData, quality)
}

export async function encodeChromaJpegFromBitmap(
  bmp: ImageBitmap,
  targetW: number,
  targetH: number,
  blurPx: number,
  quality: number
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
  if (blurPx > 0) {
    ctx.filter = `blur(${blurPx}px)`
  }
  ctx.drawImage(bmp, x, y, sw, sh)
  ctx.filter = 'none'
  const imageData = ctx.getImageData(0, 0, w, h)
  return encodeImageDataToJpeg(imageData, quality)
}
