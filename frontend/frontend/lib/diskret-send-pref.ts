/**
 * Composer Opt-in „Diskret“ (Stealth slot_tag) — Default **aus**.
 * Spec: `docs/STEALTH-SLOT-TAG-SPEC.md` §5.
 */

export const DISKRET_SEND_LS_KEY = 'morgendrot.composer.diskretSend.v1'
export const DISKRET_SEND_CHANGED_EVENT = 'morgendrot:diskret-send'

export function readDiskretSendEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DISKRET_SEND_LS_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDiskretSendEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISKRET_SEND_LS_KEY, on ? '1' : '0')
    window.dispatchEvent(new CustomEvent(DISKRET_SEND_CHANGED_EVENT, { detail: { enabled: on } }))
  } catch {
    /* ignore */
  }
}
