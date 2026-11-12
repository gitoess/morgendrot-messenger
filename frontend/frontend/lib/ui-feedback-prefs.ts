/**
 * Klick-Ton / Hover-Magnet — lokal, ohne Vault.
 */

export const UI_FEEDBACK_PREFS_CHANGED = 'morgendrot:ui-feedback-prefs-changed'

const LS_SOUND = 'morgendrot.ui.feedback.sound.v1'
const LS_MAGNET = 'morgendrot.ui.feedback.magnet.v1'

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* ignore */
  }
  return fallback
}

function writeBool(key: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value ? '1' : '0')
    window.dispatchEvent(
      new CustomEvent(UI_FEEDBACK_PREFS_CHANGED, {
        detail: { soundEnabled: readSoundFeedbackEnabled(), magnetEnabled: readMagnetFeedbackEnabled() },
      })
    )
  } catch {
    /* ignore */
  }
}

/** Klick-/Hover-Ton — Default an. */
export function readSoundFeedbackEnabled(): boolean {
  return readBool(LS_SOUND, true)
}

export function persistSoundFeedbackEnabled(on: boolean): void {
  writeBool(LS_SOUND, on)
}

/** Hover-/Press-„Widerstand“ (Scale) — Default aus (oft unsichtbar/clipped; optional). */
export function readMagnetFeedbackEnabled(): boolean {
  return readBool(LS_MAGNET, false)
}

export function persistMagnetFeedbackEnabled(on: boolean): void {
  writeBool(LS_MAGNET, on)
}
