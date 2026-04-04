/**
 * MORG_SLIDE_V1: Keyframes als einzelne TX – Netz liefert Fragmente umsortiert.
 * Wire: [[MORG_SLIDE_V1:SequenceId|Total|Index|PayloadBase64]]
 * SequenceId darf kein "|" enthalten. Payload = ein Keyframe (z. B. kompakter Bild-Blob).
 *
 * No-AI-Slideshow (Server/Sharp, später): Statt Bewegungserkennung per ML genügt ein deterministischer
 * Frame-Vergleich (z. B. downscalen → Grayscale → |Δ| > Schwellwert), dann minimales Bounding-Rect
 * oder Kachel-Maske; nur dieser Ausschnitt als kleines WebP kodieren. Pro Frame spart man gegenüber
 * Vollbildern Header+Pixel; WebP-Header pro Mini-Blob bleibt Overhead – Chroma in der bestehenden
 * Pipeline ist aktuell PNG (siehe VaultImagePipeline); Roh-UV-Buffer wäre ein Format-Upgrade (Version).
 *
 * Frontend: Überblendung rein per CSS (opacity/transition ~300–400 ms), kein Interpolations-ML.
 */

export const MORG_SLIDE_V1_PREFIX = '[[MORG_SLIDE_V1:'
export const MORG_SLIDE_V1_SUFFIX = ']]'

export type ParsedSlideFragment = {
  sequenceId: string
  total: number
  index: number
  payloadBase64: string
}

export function parseSlideFragmentMessage(content: string): ParsedSlideFragment | null {
  const s = content.replace(/^\uFEFF/, '').trimStart()
  const idx = s.indexOf(MORG_SLIDE_V1_PREFIX)
  if (idx === -1) return null
  const tail = s.slice(idx)
  const end = tail.indexOf(MORG_SLIDE_V1_SUFFIX, MORG_SLIDE_V1_PREFIX.length)
  if (end === -1) return null
  const inner = tail.slice(MORG_SLIDE_V1_PREFIX.length, end).replace(/\s/g, '')
  const parts = inner.split('|')
  if (parts.length < 4) return null
  const payloadBase64 = parts[parts.length - 1]!
  const index = Number(parts[parts.length - 2])
  const total = Number(parts[parts.length - 3])
  const sequenceId = parts.slice(0, -3).join('|')
  if (!sequenceId || !Number.isFinite(total) || !Number.isFinite(index)) return null
  if (total < 1 || index < 0 || index >= total) return null
  if (!payloadBase64) return null
  return { sequenceId, total, index, payloadBase64 }
}
