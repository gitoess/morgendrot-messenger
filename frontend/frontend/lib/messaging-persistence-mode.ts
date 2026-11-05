/** On-Chain-Persistenz: Event (flüchtig) vs. Mailbox (persistent) — unabhängig von Verschlüsselung (`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`). */
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

/** Kurzbeschreibung des gewählten Chain-Pfads für die Transport-Karte. */
export function describeChainPersistenceRoute(
  encrypted: boolean,
  mode: MessagingPersistenceMode
): { label: string; detail: string } {
  if (encrypted && mode === 'event') {
    return {
      label: 'Verschlüsseltes Event',
      detail:
        'send_encrypted_message — schnell, kein Mailbox-Objekt. Nicht Burn/Purge-fähig (Explorer behält Events).',
    }
  }
  if (encrypted && mode === 'mailbox') {
    return {
      label: 'Verschlüsselt · Mailbox',
      detail: 'store_encrypted_message — Postamt-Objekt; TTL/Purge/Burn-on-read möglich.',
    }
  }
  if (!encrypted && mode === 'event') {
    return {
      label: 'Klartext · Event',
      detail:
        'send_plaintext_message — schnell, öffentlich, flüchtig. Nicht Burn/Purge-fähig (Ledger-Historie bleibt).',
    }
  }
  return {
    label: 'Klartext · Mailbox',
    detail: 'store_plaintext_message — Klartext in der Mailbox; Purge/Burn möglich (Explorer: TX bleibt).',
  }
}
