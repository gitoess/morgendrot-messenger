/**
 * Meshtastic Kanal-Index laut Doku: 0..7.
 * Diese Helfer sind bewusst klein und UI-neutral (H.3o.6 Schritt 1).
 */

export const MESHTASTIC_CHANNEL_INDEX_MIN = 0
export const MESHTASTIC_CHANNEL_INDEX_MAX = 7

export function isValidMeshtasticChannelIndex(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= MESHTASTIC_CHANNEL_INDEX_MIN &&
    v <= MESHTASTIC_CHANNEL_INDEX_MAX
  )
}

/** Ungültig/leer => undefined (Default-Kanal). */
export function normalizeMeshtasticChannelIndex(v: unknown): number | undefined {
  if (typeof v === 'string' && v.trim() === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return undefined
  return isValidMeshtasticChannelIndex(n) ? n : undefined
}

