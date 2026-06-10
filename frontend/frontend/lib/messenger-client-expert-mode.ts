'use client'

/** Geräte-local: Nutzer aktiviert Experten-UI (Posteingang Package-ID, Pulse-Dev-Tools). */
export const MESSENGER_CLIENT_EXPERT_MODE_LS = 'morgendrot.messenger.expertMode'

/** Legacy (Pulse-Panel Dev-Schalter) — nur Fallback wenn neuer Key nie gesetzt wurde. */
export const LEGACY_DEV_EXPERT_TOOLS_LS = 'morgendrot.dev.expertTools'

export const MESSENGER_CLIENT_EXPERT_MODE_CHANGED = 'morgendrot:messenger-client-expert-mode-changed'

export function isMessengerClientExpertModeEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const explicit = window.localStorage.getItem(MESSENGER_CLIENT_EXPERT_MODE_LS)
    if (explicit === '0') return false
    if (explicit === '1') return true
    return window.localStorage.getItem(LEGACY_DEV_EXPERT_TOOLS_LS) === '1'
  } catch {
    /* ignore */
  }
  return false
}

export function setMessengerClientExpertModeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MESSENGER_CLIENT_EXPERT_MODE_LS, enabled ? '1' : '0')
    if (enabled) {
      window.localStorage.setItem(LEGACY_DEV_EXPERT_TOOLS_LS, '1')
    } else {
      window.localStorage.setItem(LEGACY_DEV_EXPERT_TOOLS_LS, '0')
    }
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(MESSENGER_CLIENT_EXPERT_MODE_CHANGED, { detail: { enabled } }))
}
