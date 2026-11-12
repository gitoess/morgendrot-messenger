/**
 * Direkt-RPC: Gas/Mailbox-Object-Version oft veraltet direkt nach vorherigem Spend.
 * TX neu bauen (frisches Gas) + Retry.
 */

import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'

export function isStaleObjectVersionError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    (m.includes('is not available') && m.includes('version')) ||
    m.includes('not available for consumption') ||
    m.includes('current version') ||
    m.includes('version mismatch') ||
    m.includes('object version') ||
    (m.includes('objekt-version') && m.includes('veraltet'))
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * `runAttempt` muss jedes Mal eine **neue** TX bauen (inkl. attachGas), sonst bleibt die Version alt.
 */
export async function withStaleObjectVersionRetry<T extends { ok: boolean; error?: string }>(
  runAttempt: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number }
): Promise<T> {
  const attempts = opts?.attempts ?? 3
  const baseDelayMs = opts?.baseDelayMs ?? 700
  let last: T | null = null
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(baseDelayMs * i)
    last = await runAttempt()
    if (last.ok) return last
    const err = last.error || ''
    if (!isStaleObjectVersionError(err) && !isStaleObjectVersionError(formatDirectIotaSubmitError(err))) {
      return last
    }
  }
  return last!
}
