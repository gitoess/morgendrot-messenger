'use client'

export type ForensicBatchArchiveMode = 'plaintext' | 'encrypted'

export const FORENSIC_BATCH_MAX_MSGS_PER_TX = 50
/** Grobe PTB-Obergrenze (Serialisierung + Gas) — dynamisches Packen statt fix 25. */
export const FORENSIC_BATCH_MAX_TX_WIRE_BYTES = 400_000
export const FORENSIC_BATCH_ESTIMATED_PTB_OVERHEAD_BYTES = 2_048

const LS_AUTO = 'morgendrot.forensicBatchAutoArchive'
const LS_INTERVAL = 'morgendrot.forensicBatchAutoIntervalMin'
const LS_MODE = 'morgendrot.forensicBatchArchiveMode'

export const FORENSIC_BATCH_AUTO_INTERVAL_OPTIONS_MIN = [5, 15, 30] as const
export type ForensicBatchAutoIntervalMin = (typeof FORENSIC_BATCH_AUTO_INTERVAL_OPTIONS_MIN)[number]

export const FORENSIC_BATCH_CHANGED = 'morgendrot:forensic-batch-changed'

export function notifyForensicBatchChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(FORENSIC_BATCH_CHANGED))
}

export function readForensicBatchAutoArchiveEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_AUTO) === '1'
  } catch {
    return false
  }
}

export function writeForensicBatchAutoArchiveEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) window.localStorage.setItem(LS_AUTO, '1')
    else window.localStorage.removeItem(LS_AUTO)
  } catch {
    /* ignore */
  }
  notifyForensicBatchChanged()
}

export function readForensicBatchAutoIntervalMin(): ForensicBatchAutoIntervalMin {
  if (typeof window === 'undefined') return 15
  try {
    const n = Number(window.localStorage.getItem(LS_INTERVAL) ?? '15')
    if (n === 5 || n === 15 || n === 30) return n
    return 15
  } catch {
    return 15
  }
}

export function writeForensicBatchAutoIntervalMin(min: ForensicBatchAutoIntervalMin): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_INTERVAL, String(min))
  } catch {
    /* ignore */
  }
  notifyForensicBatchChanged()
}

export function readForensicBatchArchiveMode(): ForensicBatchArchiveMode {
  if (typeof window === 'undefined') return 'plaintext'
  try {
    return window.localStorage.getItem(LS_MODE) === 'encrypted' ? 'encrypted' : 'plaintext'
  } catch {
    return 'plaintext'
  }
}

export function writeForensicBatchArchiveMode(mode: ForensicBatchArchiveMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_MODE, mode)
  } catch {
    /* ignore */
  }
  notifyForensicBatchChanged()
}
