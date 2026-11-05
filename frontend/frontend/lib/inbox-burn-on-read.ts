/**
 * Opt-in Burn-on-read: nach dem Lesen Purge von Chain vorschlagen (kein Auto ohne Bestätigung).
 */
const LS_KEY = 'morgendrot.inbox.burnOnRead.v1'

export const INBOX_BURN_ON_READ_CHANGED = 'morgendrot:inbox-burn-on-read-changed'

export function readBurnOnReadEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_KEY) === '1'
  } catch {
    return false
  }
}

export function writeBurnOnReadEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, on ? '1' : '0')
    window.dispatchEvent(new CustomEvent(INBOX_BURN_ON_READ_CHANGED, { detail: { enabled: on } }))
  } catch {
    /* ignore */
  }
}

export const BURN_ON_READ_CONFIRM =
  'Burn-on-read: Diese Nachricht jetzt von der Chain löschen (Purge/Rebate)?\n\n' +
  'Lokal ausgeblendet; on-chain nur wenn Purge möglich (ENABLE_PURGE / MAILBOX).'
