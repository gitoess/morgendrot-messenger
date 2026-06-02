'use client'

/** Chat-Header / Puls: gleicher Tab hört kein `storage` — nach LS-Änderungen feuern. */
export const DIRECT_IOTA_UI_CHANGED = 'morgendrot-direct-iota-ui-changed' as const

export function notifyDirectIotaUiChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(DIRECT_IOTA_UI_CHANGED))
  } catch {
    /* ignore */
  }
}
