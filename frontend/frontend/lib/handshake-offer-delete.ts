import type { ApiStatus } from '@/frontend/lib/api/status'
import { purgeHandshakeHybrid } from '@/frontend/lib/purge-handshake-hybrid'

export type HandshakeOfferSource = 'mailbox' | 'event'

/** On-chain Purge nur sinnvoll, wenn der Handshake als HsKey in der Mailbox liegt. */
export function canAttemptHandshakeOnChainPurge(
  source: HandshakeOfferSource,
  apiStatus?: ApiStatus | null
): boolean {
  if (source !== 'mailbox') return false
  if (apiStatus?.locked === true) return false
  const mb = (apiStatus?.mailboxId ?? '').trim()
  return /^0x[a-fA-F0-9]{64}$/i.test(mb)
}

export type PurgeHandshakeOfferResult =
  | { ok: true; onChain: true; message?: string }
  | { ok: true; onChain: false; reason: 'event-only' | 'mailbox-unavailable' | 'skipped' }
  | { ok: false; onChain: boolean; error: string }

/** Versucht Mailbox-Purge; Event-only wird übersprungen (kein Chain-Eintrag löschbar). */
export async function tryPurgeHandshakeOfferOnChain(p: {
  recipient: string
  sender: string
  source: HandshakeOfferSource
  apiStatus?: ApiStatus | null
}): Promise<PurgeHandshakeOfferResult> {
  if (p.source !== 'mailbox') {
    return { ok: true, onChain: false, reason: 'event-only' }
  }
  if (!canAttemptHandshakeOnChainPurge(p.source, p.apiStatus)) {
    return { ok: true, onChain: false, reason: 'mailbox-unavailable' }
  }
  const res = await purgeHandshakeHybrid(p.recipient, p.sender, {
    backendReachable: p.apiStatus?.backendRunning !== false,
  })
  if (res.ok) {
    return {
      ok: true,
      onChain: true,
      message: res.message,
    }
  }
  return { ok: false, onChain: true, error: res.error || 'Purge fehlgeschlagen' }
}
