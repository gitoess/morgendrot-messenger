import { fetchStatus } from '@/frontend/lib/api/status'

/** Pollt GET /api/status bis die Basis antwortet (z. B. nach explizitem Backend-Neustart). */
export async function waitForBackend(options?: {
  maxMs?: number
  intervalMs?: number
}): Promise<boolean> {
  const maxMs = options?.maxMs ?? 90_000
  const intervalMs = options?.intervalMs ?? 1_500
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const res = await fetchStatus()
    if ('pollClockHint' in res && res.backendRunning) return true
    await new Promise((r) => window.setTimeout(r, intervalMs))
  }
  return false
}
