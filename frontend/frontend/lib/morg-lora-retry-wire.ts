/**
 * Lokale Abbruch-/Retry-Zeile im Posteingang (nicht über Funk).
 * Composer behält `attachedLora`; Button in der Bubble löst denselben Sendepfad aus.
 */

export const MORG_LORA_RETRY_V1_PREFIX = '[[MORG_LORA_RETRY_V1]]' as const

export const MORG_LORA_RETRY_EVENT = 'morgendrot:lora-image-retry'

export function buildMorgLoraRetryStubMessage(detail: string): string {
  const d = detail.trim() || 'Funk-Bild abgebrochen.'
  return `${MORG_LORA_RETRY_V1_PREFIX}\n${d}\nBild bleibt im Composer — erneut senden.`
}

export function parseMorgLoraRetryStub(content: string): { detail: string } | null {
  const t = (content ?? '').trim()
  if (!t.startsWith(MORG_LORA_RETRY_V1_PREFIX)) return null
  const rest = t.slice(MORG_LORA_RETRY_V1_PREFIX.length).replace(/^\n/, '')
  const first = rest.split('\n')[0]?.trim() || 'Funk-Bild abgebrochen.'
  return { detail: first }
}

export function requestMorgLoraImageRetry(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MORG_LORA_RETRY_EVENT))
}
