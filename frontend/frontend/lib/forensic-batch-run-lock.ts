'use client'

const LS_LOCK_KEY = 'morgendrot.forensicBatchRunLock.v1'
const LOCK_TTL_MS = 10 * 60_000

let moduleRunning = false

export function tryAcquireForensicBatchRunLock(): boolean {
  if (moduleRunning) return false
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(LS_LOCK_KEY)
      if (raw) {
        const started = Number(raw)
        if (Number.isFinite(started) && Date.now() - started < LOCK_TTL_MS) return false
      }
      window.sessionStorage.setItem(LS_LOCK_KEY, String(Date.now()))
    } catch {
      /* sessionStorage blockiert — nur Modul-Lock */
    }
  }
  moduleRunning = true
  return true
}

export function releaseForensicBatchRunLock(): void {
  moduleRunning = false
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(LS_LOCK_KEY)
  } catch {
    /* ignore */
  }
}

export async function withForensicBatchRunLock<T>(
  fn: () => Promise<T>
): Promise<T | { ok: false; error: string }> {
  if (!tryAcquireForensicBatchRunLock()) {
    return { ok: false, error: 'Batch-Archiv läuft bereits — bitte warten.' }
  }
  try {
    return await fn()
  } finally {
    releaseForensicBatchRunLock()
  }
}
