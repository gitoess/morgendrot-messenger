/**
 * T53: Composer-Anhang-Vorschau an/aus (Bild / LoRa-Luma / .txt).
 * Default **an** (bisheriges Verhalten). Nur localStorage — kein Auto-Download, kein Inbox-Media.
 */

export const ATTACHMENT_PREVIEW_PREFS_CHANGED = 'morgendrot:attachment-preview-prefs-changed'
export const ATTACHMENT_PREVIEW_LS_KEY = 'morgendrot.composer.attachmentPreview.v1'

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(ATTACHMENT_PREVIEW_PREFS_CHANGED))
  } catch {
    /* ignore */
  }
}

/** Default true = Vorschau sichtbar wie bisher. */
export function readAttachmentPreviewEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(ATTACHMENT_PREVIEW_LS_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* ignore */
  }
  return true
}

export function persistAttachmentPreviewEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ATTACHMENT_PREVIEW_LS_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
  emitChanged()
}
