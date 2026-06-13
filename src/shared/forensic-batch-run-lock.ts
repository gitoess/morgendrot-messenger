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
