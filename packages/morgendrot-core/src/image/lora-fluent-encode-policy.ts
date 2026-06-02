/**
 * Reine Such-Policy für Flüchtig-LoRa (LUMA+CHROMA JPEG-Budgets) — ohne Sharp/DOM.
 * Backends liefern JPEG-Rohbytes pro Kandidat.
 */

import {
  FLUENT_LORA_CHROMA_JPEG_MAX_BYTES,
  FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES,
  FLUENT_LORA_LUMA_JPEG_MAX_BYTES,
} from './lora-fluent-limits'
import { bundleLoraProgressiveWires, newLoraMessageId, type LoraProgressiveWireBundle } from './lora-progressive-wire'

export type LoraFluentEncodeBudgets = {
  pairMax: number
  lumaMax: number
  chromaMax: number
}

export function resolveLoraFluentBudgets(maxTotalBytes?: number): LoraFluentEncodeBudgets {
  const pairMax = Math.min(
    Math.max(2048, maxTotalBytes ?? FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES),
    FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES
  )
  const lumaMax = Math.min(FLUENT_LORA_LUMA_JPEG_MAX_BYTES, Math.floor(pairMax * 0.72))
  const chromaMax = Math.min(FLUENT_LORA_CHROMA_JPEG_MAX_BYTES, pairMax - 512)
  return { pairMax, lumaMax, chromaMax }
}

const LUMA_WIDTHS = [640, 560, 480, 400, 360, 320, 280, 240, 200, 168, 144, 128] as const
const LUMA_QS = [62, 58, 54, 50, 46, 42, 38, 34, 30, 28, 26, 24, 22, 20, 18] as const
const CHROMA_QS = [42, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18] as const
const LAYOUTS = [
  { w: 64, h: 48, blur: 1.4 },
  { w: 56, h: 42, blur: 1.2 },
  { w: 48, h: 36, blur: 1.0 },
  { w: 42, h: 32, blur: 0.9 },
  { w: 36, h: 28, blur: 0.85 },
  { w: 32, h: 24, blur: 0.8 },
] as const

export const FLUENT_ROBUST_SOURCE_DIMS = [1280, 1024, 896, 768, 640, 560, 480, 400, 320, 256] as const

export type LoraFluentEncodeAttempt = {
  lumaWidth: number
  lumaQuality: number
  chromaW: number
  chromaH: number
  chromaBlur: number
  chromaQuality: number
}

export type LoraFluentEncodeCallbacks = {
  encodeAttempt: (attempt: LoraFluentEncodeAttempt) => Promise<{ luma: Uint8Array; chroma: Uint8Array } | null>
}

async function searchWithBudgets(
  callbacks: LoraFluentEncodeCallbacks,
  budgets: LoraFluentEncodeBudgets
): Promise<LoraProgressiveWireBundle | null> {
  for (const lumaWidth of LUMA_WIDTHS) {
    for (const layout of LAYOUTS) {
      for (const lumaQuality of LUMA_QS) {
        for (const chromaQuality of CHROMA_QS) {
          const pair = await callbacks.encodeAttempt({
            lumaWidth,
            lumaQuality,
            chromaW: layout.w,
            chromaH: layout.h,
            chromaBlur: layout.blur,
            chromaQuality,
          })
          if (!pair) continue
          if (pair.luma.length > budgets.lumaMax) continue
          if (pair.chroma.length > budgets.chromaMax) continue
          if (pair.luma.length + pair.chroma.length > budgets.pairMax) continue
          const messageId = newLoraMessageId()
          return bundleLoraProgressiveWires(messageId, pair.luma, pair.chroma)
        }
      }
    }
  }
  return null
}

export type LoraFluentEncodePolicyOpts = {
  maxTotalBytes?: number
}

export type LoraFluentEncodePolicyResult =
  | { ok: true; bundle: LoraProgressiveWireBundle }
  | { ok: false; error: string }

/**
 * Sucht ein JPEG-Paar unter den Flüchtig-Budgets (ein Quell-Raster pro `encodeAttempt`-Kontext).
 */
export async function encodeLoraFluentWithPolicy(
  callbacks: LoraFluentEncodeCallbacks,
  opts: LoraFluentEncodePolicyOpts = {}
): Promise<LoraFluentEncodePolicyResult> {
  const budgets = resolveLoraFluentBudgets(opts.maxTotalBytes)
  const bundle = await searchWithBudgets(callbacks, budgets)
  if (bundle) return { ok: true, bundle }
  return {
    ok: false,
    error: `LoRa (Flüchtig): Kein JPEG-Paar unter ${Math.round(budgets.pairMax / 1024)} KB Gesamtgröße — anderes Motiv oder kürzeres Seitenverhältnis.`,
  }
}

export type LoraFluentRobustCallbacks = LoraFluentEncodeCallbacks & {
  /** Lädt/skaliert Quelle auf max. `dim` px Kante (JPEG-Zwischenstufe). */
  prepareSourceAtDim: (dim: number) => Promise<void>
}

/**
 * Wie Server `prepareImageForLoRaFluentRobust`: mehrere Eingangs-Raster.
 */
export async function encodeLoraFluentRobustWithPolicy(
  callbacks: LoraFluentRobustCallbacks,
  opts: LoraFluentEncodePolicyOpts = {}
): Promise<LoraFluentEncodePolicyResult> {
  const budgets = resolveLoraFluentBudgets(opts.maxTotalBytes)
  let lastErr = `LoRa (Flüchtig): Bild passt nicht unter ${Math.round(budgets.pairMax / 1024)} KB nach Kompression.`

  for (const dim of FLUENT_ROBUST_SOURCE_DIMS) {
    try {
      await callbacks.prepareSourceAtDim(dim)
      const bundle = await searchWithBudgets(callbacks, budgets)
      if (bundle) return { ok: true, bundle }
      lastErr = `LoRa (Flüchtig): Kein JPEG-Paar unter ${Math.round(budgets.pairMax / 1024)} KB.`
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      if (/JPEG-Paar|passt nicht unter|Flüchtig|Gesamtgröße/i.test(m)) {
        lastErr = m
        continue
      }
      throw e
    }
  }

  return { ok: false, error: lastErr }
}
