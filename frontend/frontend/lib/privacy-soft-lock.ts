/**
 * Weiches Privacy-Lock im Chat: Passphrasen/Signer aus RAM,
 * API-Tresor bleibt offen — kein Auto-Login-Dialog über dem Messenger.
 */

export const PRIVACY_SOFT_LOCK_CHANGED_EVENT = 'morgendrot:privacy-soft-lock'

const SS_KEY = 'morgendrot.privacySoftLock.v1'

export function isPrivacySoftLocked(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(SS_KEY) === '1'
  } catch {
    return false
  }
}

export function setPrivacySoftLocked(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) window.sessionStorage.setItem(SS_KEY, '1')
    else window.sessionStorage.removeItem(SS_KEY)
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(PRIVACY_SOFT_LOCK_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}
