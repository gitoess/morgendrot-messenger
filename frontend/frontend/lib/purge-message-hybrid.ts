'use client'

import { purgeMailboxMessage as purgeMailboxMessageApi } from '@/frontend/lib/api/chat-commands'
import { mergeDirectThenRelayErrors } from '@/frontend/lib/direct-iota-error-messages'
import {
  canTryDirectPurgeMessageSubmit,
  tryPurgeMailboxMessageViaDirectIota,
} from '@/frontend/lib/direct-iota-purge-message'
import type { Message } from '@/frontend/lib/types'
import { canUseMessengerApiRelay } from '@/frontend/lib/messenger-standalone-relay'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'

export type PurgeMailboxMessageHybridResult = {
  ok: boolean
  message?: string
  error?: string
  path?: 'direct' | 'api'
}

/** MsgKey-Adressen für on-chain Purge (recipient/sender im Move-Call). */
export function resolveMailboxPurgeAddresses(
  msg: Message,
  myAddress: string
): { recipient: string; peerSender: string } | null {
  const me = myAddress.trim()
  const from = msg.from.trim()
  const to = (msg.recipient ?? '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(me) || !/^0x[a-fA-F0-9]{64}$/i.test(from)) return null
  if (from.toLowerCase() === me.toLowerCase()) {
    if (!/^0x[a-fA-F0-9]{64}$/i.test(to)) return null
    return { recipient: to, peerSender: me }
  }
  return { recipient: me, peerSender: from }
}

export async function purgeMailboxMessageHybrid(
  msg: Message,
  opts?: { backendReachable?: boolean; mailboxObjectId?: string }
): Promise<PurgeMailboxMessageHybridResult> {
  if (!msg.chainNonce || !msg.chainPurgeable) {
    return {
      ok: false,
      error: 'On-chain Purge nicht möglich (nur Event/Funk oder fehlende Nonce).',
    }
  }
  const my = getDirectIotaSessionSignerAddress() ?? ''
  const addrs = resolveMailboxPurgeAddresses(msg, my)
  if (!addrs) {
    return { ok: false, error: 'Empfänger/Absender für Purge nicht ermittelbar (0x-Adressen prüfen).' }
  }

  const variant = msg.encrypted === false ? 'plaintext' : 'encrypted'
  const allowApiRelay = canUseMessengerApiRelay(opts)

  if (canTryDirectPurgeMessageSubmit()) {
    let direct = await tryPurgeMailboxMessageViaDirectIota({
      ...addrs,
      nonce: msg.chainNonce,
      variant,
      mailboxObjectId: opts?.mailboxObjectId,
    })
    if (!direct.ok && variant === 'encrypted') {
      direct = await tryPurgeMailboxMessageViaDirectIota({
        ...addrs,
        nonce: msg.chainNonce,
        variant: 'plaintext',
        mailboxObjectId: opts?.mailboxObjectId,
      })
    }
    if (direct.ok) {
      const digest = direct.digest ? ` Digest: ${direct.digest.slice(0, 18)}…` : ''
      return {
        ok: true,
        path: 'direct',
        message: `Nachricht purged (Direkt-RPC).${digest}`,
      }
    }
    if (!allowApiRelay) {
      return { ok: false, path: 'direct', error: direct.error }
    }
    const api = await purgeMailboxMessageApi(
      msg.chainNonce,
      msg.from.startsWith('0x') ? msg.from : undefined
    )
    if (api.ok) {
      const m =
        typeof (api as { message?: unknown }).message === 'string'
          ? (api as { message: string }).message
          : 'Nachricht purged (Morgendrot-API).'
      return { ok: true, path: 'api', message: m }
    }
    const apiErr =
      (typeof (api as { error?: unknown }).error === 'string' ? (api as { error: string }).error : '') ||
      'API-Purge fehlgeschlagen.'
    return { ok: false, error: mergeDirectThenRelayErrors(direct.error, apiErr) }
  }

  if (!allowApiRelay) {
    return {
      ok: false,
      error: 'Nachricht-Purge braucht Direkt-RPC + Signer — oder eine erreichbare Morgendrot-Basis.',
    }
  }

  const api = await purgeMailboxMessageApi(
    msg.chainNonce,
    msg.from.startsWith('0x') ? msg.from : undefined
  )
  if (api.ok) {
    const m =
      typeof (api as { message?: unknown }).message === 'string'
        ? (api as { message: string }).message
        : 'Nachricht purged.'
    return { ok: true, path: 'api', message: m }
  }
  return {
    ok: false,
    error:
      (typeof (api as { error?: unknown }).error === 'string' ? (api as { error: string }).error : '') ||
      'Purge fehlgeschlagen.',
  }
}
