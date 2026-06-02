'use client'

import { connect } from '@/frontend/lib/api/package-connect'
import { mergeDirectThenRelayErrors } from '@/frontend/lib/direct-iota-error-messages'
import { canUseMessengerApiRelay } from '@/frontend/lib/messenger-standalone-relay'
import {
  canTryDirectConnectPeer,
  tryConnectAcceptFirstIncomingViaDirectIota,
  tryConnectPeerViaDirectIota,
} from '@/frontend/lib/direct-iota-connect'

export type ConnectHybridResult = {
  ok: boolean
  message?: string
  error?: string
  path?: 'direct' | 'api'
  peerAddress?: string
  replySent?: boolean
}

export async function connectPartnerHybrid(
  partner: string,
  opts?: { backendReachable?: boolean }
): Promise<ConnectHybridResult> {
  const addr = partner.trim()
  const allowApiRelay = canUseMessengerApiRelay(opts)

  if (canTryDirectConnectPeer()) {
    const direct = await tryConnectPeerViaDirectIota(addr, { pollAttempts: 4, replyHandshake: true })
    if (direct.ok) {
      const replyNote = direct.replySent ? ' Antwort-Handshake gesendet.' : ' (ohne Antwort-Handshake — ECDH-JWK fehlt für Senden.)'
      return {
        ok: true,
        path: 'direct',
        peerAddress: direct.peerAddress,
        replySent: direct.replySent,
        message: `Verbunden (Direkt-RPC, ${direct.source}). Peer-Pub lokal.${replyNote}`,
      }
    }
    if (!allowApiRelay) {
      return { ok: false, path: 'direct', error: direct.error }
    }
    const api = await connect(addr)
    if (api.ok) {
      const msg =
        typeof (api as { message?: unknown }).message === 'string'
          ? (api as { message: string }).message
          : 'Connect gestartet (Morgendrot-API).'
      return { ok: true, path: 'api', message: msg }
    }
    return {
      ok: false,
      error: mergeDirectThenRelayErrors(direct.error, api.error || 'API-Connect fehlgeschlagen.'),
    }
  }

  if (!allowApiRelay) {
    return {
      ok: false,
      error:
        'Connect braucht Direkt-RPC + Ketten-Snapshot — oder eine erreichbare Morgendrot-Basis.',
    }
  }

  const api = await connect(addr)
  if (api.ok) {
    const msg =
      typeof (api as { message?: unknown }).message === 'string'
        ? (api as { message: string }).message
        : 'Connect gestartet.'
    return { ok: true, path: 'api', message: msg }
  }
  return { ok: false, error: api.error || 'Connect fehlgeschlagen.' }
}

/** Einsatz-Partner aus Server-.env — nur Morgendrot-API. */
export async function connectDeploymentHybrid(opts?: {
  backendReachable?: boolean
}): Promise<ConnectHybridResult> {
  if (!canUseMessengerApiRelay(opts)) {
    return { ok: false, error: 'Einsatz-Partner-Connect braucht eine erreichbare Morgendrot-Basis.' }
  }
  const api = await connect()
  if (api.ok) {
    const msg =
      typeof (api as { message?: unknown }).message === 'string'
        ? (api as { message: string }).message
        : 'Connect gestartet (PARTNER_ADDRESS / .env).'
    return { ok: true, path: 'api', message: msg }
  }
  return { ok: false, error: api.error || 'Connect fehlgeschlagen.' }
}

/** Wie „Handshake annehmen“ ohne bekannte Partner-Adresse — nur Direkt-RPC, dann API-Fallback. */
export async function connectAcceptFirstIncomingHybrid(opts?: {
  backendReachable?: boolean
}): Promise<ConnectHybridResult> {
  const allowApiRelay = canUseMessengerApiRelay(opts)

  if (canTryDirectConnectPeer()) {
    const direct = await tryConnectAcceptFirstIncomingViaDirectIota({ pollAttempts: 8 })
    if (direct.ok) {
      return {
        ok: true,
        path: 'direct',
        peerAddress: direct.peerAddress,
        replySent: direct.replySent,
        message: `Eingehender Handshake angenommen (${direct.source}, Direkt-RPC).`,
      }
    }
    if (!allowApiRelay) {
      return { ok: false, path: 'direct', error: direct.error }
    }
  }

  if (!allowApiRelay) {
    return { ok: false, error: 'Connect braucht Basis oder Direkt-RPC.' }
  }

  const api = await connect()
  if (api.ok) {
    const msg =
      typeof (api as { message?: unknown }).message === 'string'
        ? (api as { message: string }).message
        : 'Connect gestartet (wartet auf Handshake).'
    return { ok: true, path: 'api', message: msg }
  }
  return { ok: false, error: api.error || 'Connect fehlgeschlagen.' }
}
