'use client'

import { purgeHandshakeOnChainCommand } from '@/frontend/lib/api/package-connect'
import { mergeDirectThenRelayErrors } from '@/frontend/lib/direct-iota-error-messages'
import {
  canTryDirectPurgeHandshakeSubmit,
  tryPurgeHandshakeViaDirectIota,
} from '@/frontend/lib/direct-iota-purge-handshake'
import { canUseMessengerApiRelay } from '@/frontend/lib/messenger-standalone-relay'

export type PurgeHandshakeHybridResult = {
  ok: boolean
  message?: string
  error?: string
  path?: 'direct' | 'api'
}

export async function purgeHandshakeHybrid(
  recipient: string,
  peerSender: string,
  opts?: { backendReachable?: boolean; mailboxObjectId?: string }
): Promise<PurgeHandshakeHybridResult> {
  const allowApiRelay = canUseMessengerApiRelay(opts)

  if (canTryDirectPurgeHandshakeSubmit()) {
    const direct = await tryPurgeHandshakeViaDirectIota({
      recipient,
      peerSender,
      mailboxObjectId: opts?.mailboxObjectId,
    })
    if (direct.ok) {
      const digest = direct.digest ? ` Digest: ${direct.digest.slice(0, 18)}…` : ''
      return {
        ok: true,
        path: 'direct',
        message: `Handshake purged (Direkt-RPC).${digest}`,
      }
    }
    if (!allowApiRelay) {
      return { ok: false, path: 'direct', error: direct.error }
    }
    const api = await purgeHandshakeOnChainCommand(recipient, peerSender)
    if (api.ok) {
      const msg =
        typeof (api as { message?: unknown }).message === 'string'
          ? (api as { message: string }).message
          : 'Handshake purged (Morgendrot-API).'
      return { ok: true, path: 'api', message: msg }
    }
    const apiErr =
      (typeof (api as { error?: unknown }).error === 'string' ? (api as { error: string }).error : '') ||
      'API-Purge fehlgeschlagen.'
    return {
      ok: false,
      error: mergeDirectThenRelayErrors(direct.error, apiErr),
    }
  }

  if (!allowApiRelay) {
    return {
      ok: false,
      error:
        'Handshake-Purge braucht Direkt-RPC + Session-Signer — oder eine erreichbare Morgendrot-Basis.',
    }
  }

  const api = await purgeHandshakeOnChainCommand(recipient, peerSender)
  if (api.ok) {
    const msg =
      typeof (api as { message?: unknown }).message === 'string'
        ? (api as { message: string }).message
        : 'Handshake purged.'
    return { ok: true, path: 'api', message: msg }
  }
  return {
    ok: false,
    error:
      (typeof (api as { error?: unknown }).error === 'string' ? (api as { error: string }).error : '') ||
      'Purge fehlgeschlagen.',
  }
}
