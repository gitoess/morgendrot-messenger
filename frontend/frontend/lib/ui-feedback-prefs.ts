/**
 * Klick-Ton / Hover-Magnet — lokal, ohne Vault.
 */

export const UI_FEEDBACK_PREFS_CHANGED = 'morgendrot:ui-feedback-prefs-changed'

const LS_SOUND = 'morgendrot.ui.feedback.sound.v1'
const LS_SOUND_VOLUME = 'morgendrot.ui.feedback.soundVolume.v1'
const LS_KLACK = 'morgendrot.ui.feedback.klack.v1'
const LS_MAGNET = 'morgendrot.ui.feedback.magnet.v1'

/** 0–100; Default 70 — Regler-Unterschiede sollen hörbar sein. */
export const DEFAULT_SOUND_FEEDBACK_VOLUME = 70

function emitPrefsChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(
      new CustomEvent(UI_FEEDBACK_PREFS_CHANGED, {
        detail: {
          soundEnabled: readSoundFeedbackEnabled(),
          soundVolume: readSoundFeedbackVolume(),
          klackEnabled: readKlackFeedbackEnabled(),
          magnetEnabled: readMagnetFeedbackEnabled(),
        },
      })
    )
  } catch {
    /* ignore */
  }
}

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
    emitPrefsChanged()
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

/** Lautstärke 0–100 (wirkt nur wenn Ton an). */
export function readSoundFeedbackVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_SOUND_FEEDBACK_VOLUME
  try {
    const raw = localStorage.getItem(LS_SOUND_VOLUME)
    if (raw == null || raw === '') return DEFAULT_SOUND_FEEDBACK_VOLUME
    const n = Number(raw)
    if (!Number.isFinite(n)) return DEFAULT_SOUND_FEEDBACK_VOLUME
    return Math.max(0, Math.min(100, Math.round(n)))
  } catch {
    return DEFAULT_SOUND_FEEDBACK_VOLUME
  }
}

export function persistSoundFeedbackVolume(volume: number): void {
  if (typeof window === 'undefined') return
  const v = Math.max(0, Math.min(100, Math.round(volume)))
  try {
    localStorage.setItem(LS_SOUND_VOLUME, String(v))
    emitPrefsChanged()
  } catch {
    /* ignore */
  }
}

/** Mechanisches Klack beim Antippen von Buttons — getrennt vom Klick-Ton. Default an. */
export function readKlackFeedbackEnabled(): boolean {
  return readBool(LS_KLACK, true)
}

export function persistKlackFeedbackEnabled(on: boolean): void {
  writeBool(LS_KLACK, on)
}

/** Hover-/Press-„Widerstand“ (Scale) — Default aus (oft unsichtbar/clipped; optional). */
export function readMagnetFeedbackEnabled(): boolean {
  return readBool(LS_MAGNET, false)
}

export function persistMagnetFeedbackEnabled(on: boolean): void {
  writeBool(LS_MAGNET, on)
}
