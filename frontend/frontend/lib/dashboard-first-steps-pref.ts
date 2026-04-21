/** Sichtbarkeit der schlanken „Erste Schritte“-Zeile auf dem Dashboard (localStorage). */

export const FIRST_STEPS_VISIBLE_KEY = 'morgendrot.dashboardFirstStepsVisible'
const LEGACY_HIDE_KEY = 'morgendrot.hideFirstStepsCard'

export function readFirstStepsVisible(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(FIRST_STEPS_VISIBLE_KEY)
    if (v === '0' || v === 'false') return false
    if (v === '1' || v === 'true') return true
    if (window.localStorage.getItem(LEGACY_HIDE_KEY) === '1') return false
  } catch {
    /* ignore */
  }
  return true
}

export function writeFirstStepsVisible(visible: boolean): void {
  try {
    window.localStorage.setItem(FIRST_STEPS_VISIBLE_KEY, visible ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function notifyFirstStepsPrefChanged(): void {
  try {
    window.dispatchEvent(new Event('morgendrot-dashboard-first-steps-changed'))
  } catch {
    /* ignore */
  }
}
