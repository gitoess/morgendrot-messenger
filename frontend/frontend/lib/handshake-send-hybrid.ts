'use client'

import { startHandshake } from '@/frontend/lib/api/package-connect'
import { mergeDirectThenRelayErrors } from '@/frontend/lib/direct-iota-error-messages'
import { canUseMessengerApiRelay } from '@/frontend/lib/messenger-standalone-relay'
import {
  canTryDirectHandshakeSubmit,
  trySubmitHandshakeViaDirectIota,
} from '@/frontend/lib/direct-iota-handshake-submit'

export type HandshakeSendHybridResult = {
  ok: boolean
  message?: string
  error?: string
  path?: 'direct' | 'api'
}

export async function sendHandshakeHybrid(
  recipient: string,
  opts?: { backendReachable?: boolean; mailboxObjectId?: string }
): Promise<HandshakeSendHybridResult> {
  const addr = recipient.trim()
  const allowApiRelay = canUseMessengerApiRelay(opts)

  if (canTryDirectHandshakeSubmit()) {
    const direct = await trySubmitHandshakeViaDirectIota({
      recipient: addr,
      mailboxObjectId: opts?.mailboxObjectId,
    })
    if (direct.ok) {
      const digest = direct.digest ? ` Digest: ${direct.digest.slice(0, 18)}…` : ''
      return {
        ok: true,
        path: 'direct',
        message: `Handshake on-chain (Direkt-RPC).${digest}`,
      }
    }
    if (!allowApiRelay) {
      return { ok: false, path: 'direct', error: direct.error }
    }
    const api = await startHandshake(addr)
    if (api.ok) {
      const msg =
        typeof (api as { message?: unknown }).message === 'string'
          ? (api as { message: string }).message
          : 'Handshake gesendet (Morgendrot-API).'
      return { ok: true, path: 'api', message: msg }
    }
    return {
      ok: false,
      error: mergeDirectThenRelayErrors(direct.error, api.error || 'API-Handshake fehlgeschlagen.'),
    }
  }

  if (!allowApiRelay) {
    return {
      ok: false,
      error:
        'Handshake braucht Direkt-RPC + Session-Signer + ECDH-JWK (Puls) — oder eine erreichbare Morgendrot-Basis.',
    }
  }

  const api = await startHandshake(addr)
  if (api.ok) {
    const msg =
      typeof (api as { message?: unknown }).message === 'string'
        ? (api as { message: string }).message
        : 'Handshake gesendet.'
    return { ok: true, path: 'api', message: msg }
  }
  return { ok: false, error: api.error || 'Handshake fehlgeschlagen.' }
}
