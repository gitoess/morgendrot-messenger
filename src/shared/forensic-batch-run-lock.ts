/** § H.33e — verhindert parallele Boss-Batch-Läufe (Scheduler + POST /run). */
let running = false

export function tryAcquireForensicBatchRunLock(): boolean {
  if (running) return false
  running = true
  return true
}

export function releaseForensicBatchRunLock(): void {
  running = false
}

export async function withForensicBatchRunLock<T>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  if (!tryAcquireForensicBatchRunLock()) {
    return { ok: false, error: 'Forensic-Batch läuft bereits — bitte warten.' }
  }
  try {
    return await fn()
  } finally {
    releaseForensicBatchRunLock()
  }
}
