/** § Mailbox-SSOT: Klartext `/send-plain` — Event vs. Mailbox-Store (`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`). */
export const MESSAGING_PERSISTENCE_MODE_LS_KEY = 'morgendrot.messagingPersistenceMode'

export type MessagingPersistenceMode = 'event' | 'mailbox'

export const MESSAGING_PERSISTENCE_MODE_DEFAULT: MessagingPersistenceMode = 'event'

export function normalizeMessagingPersistenceMode(raw: string | null | undefined): MessagingPersistenceMode {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
  return v === 'mailbox' ? 'mailbox' : 'event'
}

export function readMessagingPersistenceModeFromStorage(): MessagingPersistenceMode {
  if (typeof window === 'undefined') return MESSAGING_PERSISTENCE_MODE_DEFAULT
  try {
    return normalizeMessagingPersistenceMode(window.localStorage.getItem(MESSAGING_PERSISTENCE_MODE_LS_KEY))
  } catch {
    return MESSAGING_PERSISTENCE_MODE_DEFAULT
  }
}

export function writeMessagingPersistenceModeToStorage(mode: MessagingPersistenceMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MESSAGING_PERSISTENCE_MODE_LS_KEY, mode)
  } catch {
    /* ignore */
  }
}
