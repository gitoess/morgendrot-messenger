/**
 * Reine Such-Policy für Flüchtig-LoRa (LUMA+CHROMA JPEG-Budgets) — ohne Sharp/DOM.
 * Backends liefern JPEG-Rohbytes pro Kandidat.
 *
 * **Schnell-Suche:** kleines Raster (nicht 10×6×12×9) — große Fotos sonst Minuten.
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
  /** ~78 % Luma (Auflösung/Schärfe), Rest Chroma. */
  const lumaMax = Math.min(FLUENT_LORA_LUMA_JPEG_MAX_BYTES, Math.floor(pairMax * 0.78))
  const chromaMax = Math.min(FLUENT_LORA_CHROMA_JPEG_MAX_BYTES, pairMax - Math.min(lumaMax, 1200))
  return { pairMax, lumaMax, chromaMax }
}

/**
 * `lumaWidth` = maxDim (längste Kante). Zielrichtung ~360 px (~2× vs. 180).
 * Passt nur wenn JPEG unter Cap; sonst nächste Stufe.
 */
const LUMA_MAX_DIMS = [360, 320, 280, 240, 200, 160, 120, 96] as const
const LUMA_QS = [48, 42, 36, 30, 24, 18, 14] as const
const CHROMA_QS = [40, 32, 24, 18] as const
const LAYOUTS = [
  { w: 72, h: 54, blur: 0.25 },
  { w: 64, h: 48, blur: 0.35 },
  { w: 56, h: 42, blur: 0.45 },
  { w: 48, h: 36, blur: 0.6 },
] as const

function scoreAttempt(
  lumaDim: number,
  lumaQ: number,
  layout: { w: number; h: number },
  chromaQ: number,
  pairBytes: number
): number {
  /**
   * Auflösung zuerst; bei gleicher Kante hohes Luma-Q (Schärfe) vor großem Chroma.
   * GRAYSCALE-Luma macht höhere Q unter Cap oft erst möglich.
   */
  return lumaDim * 50_000 + lumaQ * 200 + layout.w * layout.h * 0.25 + chromaQ + Math.floor(pairBytes / 8)
}

/** Handy-Fotos: erst stark runter, dann suchen (inkl. Notfall-Raster). */
export const FLUENT_ROBUST_SOURCE_DIMS = [640, 480, 320, 240, 160] as const

function formatPairFitError(pairMax: number): string {
  const kb = Math.round(pairMax / 1024)
  return (
    `LoRa (Flüchtig): Kein JPEG-Paar unter ${kb} KB. ` +
    `Nicht die Dateigröße/Endung — Motiv zu detailreich für Funk (Text/Screenshot/Rauschen). ` +
    `Anderes Foto versuchen oder starker Zoom auf ruhige Fläche.`
  )
}

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
  /**
   * Pro maxDim: alle Q/Layouts prüfen, **bestes** gültiges Paar nehmen.
   * Dann nächstkleinere Kante nur wenn nichts passte — nicht first-fit bei schlechtem Q.
   */
  for (const lumaDim of LUMA_MAX_DIMS) {
    let best: { luma: Uint8Array; chroma: Uint8Array; score: number } | null = null
    for (const layout of LAYOUTS) {
      for (const lumaQuality of LUMA_QS) {
        for (const chromaQuality of CHROMA_QS) {
          const pair = await callbacks.encodeAttempt({
            lumaWidth: lumaDim,
            lumaQuality,
            chromaW: layout.w,
            chromaH: layout.h,
            chromaBlur: layout.blur,
            chromaQuality,
          })
          if (!pair) continue
          if (pair.luma.length > budgets.lumaMax) continue
          if (pair.chroma.length > budgets.chromaMax) continue
          const total = pair.luma.length + pair.chroma.length
          if (total > budgets.pairMax) continue
          const score = scoreAttempt(lumaDim, lumaQuality, layout, chromaQuality, total)
          if (!best || score > best.score) {
            best = { luma: pair.luma, chroma: pair.chroma, score }
          }
        }
      }
    }
    if (best) {
      const messageId = newLoraMessageId()
      return bundleLoraProgressiveWires(messageId, best.luma, best.chroma)
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
  return { ok: false, error: formatPairFitError(budgets.pairMax) }
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
  let lastErr = formatPairFitError(budgets.pairMax)

  for (const dim of FLUENT_ROBUST_SOURCE_DIMS) {
    try {
      await callbacks.prepareSourceAtDim(dim)
      const bundle = await searchWithBudgets(callbacks, budgets)
      if (bundle) return { ok: true, bundle }
      lastErr = formatPairFitError(budgets.pairMax)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      if (/JPEG-Paar|passt nicht unter|Flüchtig|Gesamtgröße|detailreich/i.test(m)) {
        lastErr = m
        continue
      }
      throw e
    }
  }

  return { ok: false, error: lastErr }
}
