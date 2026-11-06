'use client'

import { executeCommand } from '@/frontend/lib/api/execute-command'
import { mergeDirectThenRelayErrors } from '@/frontend/lib/direct-iota-error-messages'
import {
  canTryDirectPurgeMessageSubmit,
  tryPurgeMailboxMessageViaDirectIota,
} from '@/frontend/lib/direct-iota-purge-message'
import { tryPurgeTeamPlaintextBroadcastViaDirectIota } from '@/frontend/lib/direct-iota-purge-team-broadcast'
import {
  resolveMailboxPurgeTarget,
  teamBroadcastPurgeHint,
  type MailboxPurgeTarget,
} from '@/frontend/lib/mailbox-purge-routing'
import type { Message } from '@/frontend/lib/types'
import { canUseMessengerApiRelay } from '@/frontend/lib/messenger-standalone-relay'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { recordMsgBurnActivity } from '@/frontend/lib/iota-activity-local-log'

export type PurgeMailboxMessageHybridResult = {
  ok: boolean
  message?: string
  error?: string
  path?: 'direct' | 'api'
  digest?: string
}

export { resolveMailboxPurgeTarget, teamBroadcastPurgeHint }

function isUnknownMessengerCommandError(err: string | undefined): boolean {
  return /unbekannter befehl/i.test(String(err ?? ''))
}

function formatPurgeRelayError(err: string | undefined): string {
  const e = (err || '').trim()
  if (isUnknownMessengerCommandError(e)) {
    return (
      'Backend kennt den Purge-Befehl noch nicht — npm run dev:messenger neu starten (API :3342). ' +
      'Team-Broadcast braucht außerdem Move-Deploy mit purge_team_plaintext_broadcast.'
    )
  }
  return e
}

async function purgeTeamBroadcastHybrid(
  target: Extract<MailboxPurgeTarget, { kind: 'team-broadcast' }>,
  allowApiRelay: boolean
): Promise<PurgeMailboxMessageHybridResult> {
  let directErr: string | undefined
  if (canTryDirectPurgeMessageSubmit()) {
    const dr = await tryPurgeTeamPlaintextBroadcastViaDirectIota({
      teamMailboxObjectId: target.teamMailboxObjectId,
      broadcastSender: target.broadcastSender,
      nonce: target.nonce,
    })
    if (dr.ok) {
      recordMsgBurnActivity({
        digest: dr.digest,
        peer: target.broadcastSender,
        mailboxObjectId: target.teamMailboxObjectId,
        nonce: target.nonce,
        plaintext: true,
      })
      const digest = dr.digest ? ` Digest: ${dr.digest.slice(0, 18)}…` : ''
      return { ok: true, path: 'direct', digest: dr.digest, message: `Team-Broadcast geburnt (Direkt-RPC).${digest}` }
    }
    directErr = dr.error
  }
  if (!allowApiRelay) {
    return { ok: false, path: 'direct', error: directErr ?? 'Direkt-Purge nicht verfügbar.' }
  }
  const teamArgs = [target.teamMailboxObjectId, target.broadcastSender, target.nonce] as const
  let api = await executeCommand(
    '/purge-msg',
    [...teamArgs, 'team-broadcast'],
    { timeoutMs: 120_000 }
  )
  if (!api.ok && isUnknownMessengerCommandError(String((api as { error?: unknown }).error || ''))) {
    api = await executeCommand('/purge-team-broadcast', [...teamArgs], { timeoutMs: 120_000 })
  }
  if (api.ok) {
    const m =
      typeof (api as { message?: unknown }).message === 'string'
        ? (api as { message: string }).message
        : 'Team-Broadcast purged (Morgendrot-API).'
    return { ok: true, path: 'api', message: m }
  }
  const apiErr = formatPurgeRelayError(
    (typeof (api as { error?: unknown }).error === 'string' ? (api as { error: string }).error : '') ||
      (typeof (api as { message?: unknown }).message === 'string' ? (api as { message: string }).message : '') ||
      'API-Purge fehlgeschlagen.'
  )
  return { ok: false, error: mergeDirectThenRelayErrors(directErr, apiErr) }
}

function noteBurnSuccess(
  target: Extract<MailboxPurgeTarget, { kind: 'pairwise' }>,
  digest: string | undefined,
  plaintext: boolean,
  mailboxObjectId?: string
): void {
  recordMsgBurnActivity({
    digest,
    peer: target.peerSender === target.recipient ? undefined : target.peerSender,
    mailboxObjectId: mailboxObjectId ?? target.mailboxObjectId,
    nonce: target.nonce,
    plaintext,
  })
}

async function purgePairwiseHybrid(
  target: Extract<MailboxPurgeTarget, { kind: 'pairwise' }>,
  allowApiRelay: boolean
): Promise<PurgeMailboxMessageHybridResult> {
  if (canTryDirectPurgeMessageSubmit()) {
    let usedPlain = target.variant === 'plaintext'
    let direct = await tryPurgeMailboxMessageViaDirectIota({
      recipient: target.recipient,
      peerSender: target.peerSender,
      nonce: target.nonce,
      variant: target.variant,
      mailboxObjectId: target.mailboxObjectId,
    })
    if (!direct.ok && target.variant === 'encrypted') {
      usedPlain = true
      direct = await tryPurgeMailboxMessageViaDirectIota({
        recipient: target.recipient,
        peerSender: target.peerSender,
        nonce: target.nonce,
        variant: 'plaintext',
        mailboxObjectId: target.mailboxObjectId,
      })
    }
    if (direct.ok) {
      noteBurnSuccess(target, direct.digest, usedPlain, direct.mailboxObjectId)
      const digest = direct.digest ? ` Digest: ${direct.digest.slice(0, 18)}…` : ''
      return {
        ok: true,
        path: 'direct',
        digest: direct.digest,
        message: `Nachricht geburnt (Direkt-RPC).${digest}`,
      }
    }
    if (!allowApiRelay) {
      return { ok: false, path: 'direct', error: direct.error }
    }
    const api = await executeCommand('/purge-msg', [target.recipient, target.peerSender, target.nonce], {
      timeoutMs: 120_000,
    })
    if (api.ok) {
      const dig =
        typeof (api as { txDigest?: unknown }).txDigest === 'string'
          ? (api as { txDigest: string }).txDigest
          : undefined
      noteBurnSuccess(target, dig, usedPlain)
      const m =
        typeof (api as { message?: unknown }).message === 'string'
          ? (api as { message: string }).message
          : 'Nachricht geburnt (Morgendrot-API).'
      return { ok: true, path: 'api', digest: dig, message: m }
    }
    const apiErr = formatPurgeRelayError(
      (typeof (api as { error?: unknown }).error === 'string' ? (api as { error: string }).error : '') ||
        'API-Burn fehlgeschlagen.'
    )
    return { ok: false, error: mergeDirectThenRelayErrors(direct.error, apiErr) }
  }

  if (!allowApiRelay) {
    return {
      ok: false,
      error: 'Burn braucht Direkt-RPC + Signer — oder eine erreichbare Morgendrot-Basis.',
    }
  }

  const api = await executeCommand('/purge-msg', [target.recipient, target.peerSender, target.nonce], {
    timeoutMs: 120_000,
  })
  if (api.ok) {
    const dig =
      typeof (api as { txDigest?: unknown }).txDigest === 'string'
        ? (api as { txDigest: string }).txDigest
        : undefined
    noteBurnSuccess(target, dig, target.variant === 'plaintext')
    const m =
      typeof (api as { message?: unknown }).message === 'string'
        ? (api as { message: string }).message
        : 'Nachricht geburnt.'
    return { ok: true, path: 'api', digest: dig, message: m }
  }
  return {
    ok: false,
    error:
      (typeof (api as { error?: unknown }).error === 'string' ? (api as { error: string }).error : '') ||
      'Burn fehlgeschlagen.',
  }
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
  const target = resolveMailboxPurgeTarget(msg, my)
  if (!target) {
    return { ok: false, error: 'Purge-Ziel nicht ermittelbar (0x-Adressen/Team-Mailbox prüfen).' }
  }
  if (target.kind === 'pairwise') {
    const override = (opts?.mailboxObjectId || msg.chainMailboxObjectId || '').trim()
    if (override) target.mailboxObjectId = override.toLowerCase()
  }
  const allowApiRelay = canUseMessengerApiRelay(opts)
  if (target.kind === 'team-broadcast') {
    return purgeTeamBroadcastHybrid(target, allowApiRelay)
  }
  return purgePairwiseHybrid(target, allowApiRelay)
}
