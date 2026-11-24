/**
 * § H.25a — Flüchtig (LoRa): Validierung, Segmentplan, Zeit-Schätzung.
 */

import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import { parseLoraProgressiveMessage } from '@/frontend/lib/lora-progressive-image-client'
import {
  FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES,
  FLUENT_LORA_MAX_SEGMENTS_PER_PHASE,
} from '@/frontend/lib/lora-image-morg-seg-v1-limits'
import { MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES, wireUtf8ByteLength } from '@/frontend/lib/compact-image-wire'
import {
  MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES,
  buildMorgSegV1Wire,
  computeMaxMorgSegV1RawPayloadBytes,
  type MorgSegV1HeaderDims,
} from '@/frontend/lib/lora-sarq-wire'

export { FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES, FLUENT_LORA_MAX_SEGMENTS_PER_PHASE } from '@/frontend/lib/lora-image-morg-seg-v1-limits'

const SECONDS_PER_SEGMENT_MIN = 1.2
const SECONDS_PER_SEGMENT_MAX = 3.5

export type FluentLoraPhasePlan = {
  phase: 'luma' | 'chroma'
  msgId: string
  jpeg: Uint8Array
  n: number
  maxRawPerSegment: number
  wires: string[]
}

export type FluentLoraImagePlan = {
  luma: FluentLoraPhasePlan
  chroma: FluentLoraPhasePlan
  totalBytes: number
  totalSegments: number
  estimateSecondsMin: number
  estimateSecondsMax: number
}

export type FluentLoraImageValidationError = {
  ok: false
  message: string
  idleMs?: number
}

export function isFluentLoraImageValidationError(
  r: FluentLoraPhasePlan | FluentLoraImageValidationError
): r is FluentLoraImageValidationError {
  return 'ok' in r && r.ok === false
}

export function segmentCountForJpeg(jpegLen: number, maxRaw: number): number {
  if (jpegLen <= 0) return 0
  return Math.ceil(jpegLen / Math.max(1, maxRaw))
}

export function buildPhaseSegmentWires(
  phase: 'luma' | 'chroma',
  msgId: string,
  jpeg: Uint8Array
): FluentLoraPhasePlan | FluentLoraImageValidationError {
  if (jpeg.length < 1) {
    return { ok: false, message: 'LoRa-Bild: leere JPEG-Daten.', idleMs: 6000 }
  }
  /** Worst-Case-`seg`-Ziffern: Budget mit `seg=n-1`, sonst sprengen spätere Segmente ToRadio 512. */
  let maxRaw = MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES
  let n = segmentCountForJpeg(jpeg.length, maxRaw)
  for (let iter = 0; iter < 8; iter++) {
    if (n < 1) {
      return { ok: false, message: 'LoRa-Bild: leere JPEG-Daten.', idleMs: 6000 }
    }
    if (n > FLUENT_LORA_MAX_SEGMENTS_PER_PHASE) {
      return {
        ok: false,
        message: `LoRa-Bild: ${phase} ${jpeg.length} B → ${n} Segmente (max. ${FLUENT_LORA_MAX_SEGMENTS_PER_PHASE} × ~${maxRaw} B). Datei-Größe ≠ Funk-JPEG; Encoder muss kleiner kodieren (Ziel ≤ ${Math.round(FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES / 1024)} KB LUMA+CHROMA).`,
        idleMs: 10_000,
      }
    }
    const dims: MorgSegV1HeaderDims = { msgId, phase, seg: Math.max(0, n - 1), n }
    const next = computeMaxMorgSegV1RawPayloadBytes(dims)
    if (next < 1) {
      return { ok: false, message: 'LoRa-Bild: Segment-Budget zu klein (Wire-Header).', idleMs: 6000 }
    }
    const nextN = segmentCountForJpeg(jpeg.length, next)
    if (next === maxRaw && nextN === n) break
    maxRaw = next
    n = nextN
  }
  if (n > FLUENT_LORA_MAX_SEGMENTS_PER_PHASE || n * maxRaw < jpeg.length) {
    return {
      ok: false,
      message: `LoRa-Bild: ${phase} passt nicht in ${FLUENT_LORA_MAX_SEGMENTS_PER_PHASE} Segmente (Mesh-Text ≤ ${MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES} B). Bitte kleineres Motiv wählen.`,
      idleMs: 10_000,
    }
  }
  const wires: string[] = []
  for (let seg = 0; seg < n; seg++) {
    const start = seg * maxRaw
    const end = Math.min(jpeg.length, start + maxRaw)
    const slice = jpeg.subarray(start, end)
    const wire = buildMorgSegV1Wire({
      msgId,
      phase,
      seg,
      n,
      raw: slice,
    })
    if (wireUtf8ByteLength(wire) > MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES) {
      return {
        ok: false,
        message: `LoRa-Bild: Segment ${seg + 1}/${n} überschreitet Mesh-Text-Limit (${MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES} B UTF-8).`,
        idleMs: 8000,
      }
    }
    wires.push(wire)
  }
  return { phase, msgId, jpeg, n, maxRawPerSegment: maxRaw, wires }
}

export function isFluentLoraImagePlan(
  r: FluentLoraImagePlan | FluentLoraImageValidationError
): r is FluentLoraImagePlan {
  return !('ok' in r)
}

export function planFluentLoraImage(attached: ChatAttachedLora): FluentLoraImagePlan | FluentLoraImageValidationError {
  const lumaParsed = parseLoraProgressiveMessage(attached.lumaWire)
  const chromaParsed = parseLoraProgressiveMessage(attached.chromaWire)
  if (!lumaParsed || lumaParsed.kind !== 'luma') {
    return { ok: false, message: 'LoRa-Bild: Luma-Wire ungültig.', idleMs: 6000 }
  }
  if (!chromaParsed || chromaParsed.kind !== 'chroma') {
    return { ok: false, message: 'LoRa-Bild: Chroma-Wire ungültig.', idleMs: 6000 }
  }
  const totalBytes = lumaParsed.jpeg.length + chromaParsed.jpeg.length
  if (totalBytes > FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES) {
    return {
      ok: false,
      message: `LoRa-Bild zu groß: ${Math.round(totalBytes / 1024)} KB (max. ${Math.round(FLUENT_LORA_IMAGE_MAX_TOTAL_BYTES / 1024)} KB gesamt nach Kompression).`,
      idleMs: 10_000,
    }
  }
  const lumaBuilt = buildPhaseSegmentWires('luma', lumaParsed.msgId, lumaParsed.jpeg)
  if (isFluentLoraImageValidationError(lumaBuilt)) return lumaBuilt
  const chromaBuilt = buildPhaseSegmentWires('chroma', chromaParsed.msgId, chromaParsed.jpeg)
  if (isFluentLoraImageValidationError(chromaBuilt)) return chromaBuilt
  const totalSegments = lumaBuilt.n + chromaBuilt.n
  return {
    luma: lumaBuilt,
    chroma: chromaBuilt,
    totalBytes,
    totalSegments,
    estimateSecondsMin: Math.max(15, Math.round(totalSegments * SECONDS_PER_SEGMENT_MIN)),
    estimateSecondsMax: Math.max(30, Math.round(totalSegments * SECONDS_PER_SEGMENT_MAX)),
  }
}

/** Kurz — kein Duty-/ETA-Essay im Composer. */
export function formatFluentLoraPreSendWarning(plan: FluentLoraImagePlan): string {
  return `LoRa-Bild · ${plan.luma.n}+${plan.chroma.n} Segmente · ~${(plan.totalBytes / 1024).toFixed(1)} KB`
}
