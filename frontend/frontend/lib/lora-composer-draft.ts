/**
 * Persistenz für unvollständige LoRa-Bild-TX (Composer).
 * Nach Reload / Abbruch bleibt der Anhang für „Nochmals senden“ / S-ARQ-Resume.
 */

import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'

export const LORA_COMPOSER_DRAFT_LS = 'morgendrot.loraComposerDraft.v1'

export type LoraComposerDraft = {
  attached: ChatAttachedLora
  savedAt: number
}

function isAttachedShape(v: unknown): v is ChatAttachedLora {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.lumaWire === 'string' &&
    o.lumaWire.includes('MORG_LUMA') &&
    typeof o.chromaWire === 'string' &&
    o.chromaWire.includes('MORG_CHROMA') &&
    typeof o.messageId === 'string' &&
    typeof o.lumaJpegBytes === 'number' &&
    typeof o.chromaJpegBytes === 'number'
  )
}

export function saveLoraComposerDraft(attached: ChatAttachedLora): void {
  if (typeof window === 'undefined') return
  try {
    const draft: LoraComposerDraft = { attached, savedAt: Date.now() }
    window.localStorage.setItem(LORA_COMPOSER_DRAFT_LS, JSON.stringify(draft))
  } catch {
    /* Quota / private mode */
  }
}

export function clearLoraComposerDraft(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LORA_COMPOSER_DRAFT_LS)
  } catch {
    /* ignore */
  }
}

/** Max. 7 Tage — ältere Drafts verwerfen. */
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function loadLoraComposerDraft(): ChatAttachedLora | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LORA_COMPOSER_DRAFT_LS)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LoraComposerDraft>
    if (!isAttachedShape(parsed.attached)) {
      clearLoraComposerDraft()
      return null
    }
    const age = Date.now() - (typeof parsed.savedAt === 'number' ? parsed.savedAt : 0)
    if (age > DRAFT_MAX_AGE_MS) {
      clearLoraComposerDraft()
      return null
    }
    return parsed.attached
  } catch {
    clearLoraComposerDraft()
    return null
  }
}
