'use client'

import {
  attachGasPaymentForOwner,
  buildPurgeMailboxMessageTransaction,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
  type PurgeMailboxMessageVariant,
  validateMessagingMailboxObjectForPackage,
} from '@morgendrot/core/iota'
import { resolveDirectIotaSubmitContext } from '@/frontend/lib/direct-iota-submit-context'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { canTryDirectPurgeHandshakeSubmit } from '@/frontend/lib/direct-iota-purge-handshake'
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
import { resolveDirectMailboxUsePrivateMoveCall } from '@/frontend/lib/direct-mailbox-object-kind'
import { canUseDirectEncryptedMailboxDrain } from '@/frontend/lib/direct-iota-chain-context'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export function canTryDirectPurgeMessageSubmit(): boolean {
  return canTryDirectPurgeHandshakeSubmit()
}

/** Abort 10 / 43 — MsgKey bzw. PlainMsgKey fehlt in dieser Mailbox. */
export function isMailboxMsgMissingPurgeError(err: string | undefined): boolean {
  const e = (err || '').toLowerCase()
  if (!e) return false
  if (e.includes('abort code: 10') || e.includes('abort code: 43')) return true
  if (e.includes('e_msg_missing') || e.includes('e_plain_msg_missing')) return true
  if (e.includes('purge_message_on_uid') && e.includes('abort')) return true
  if (e.includes('purge_plaintext_mail_entry') && e.includes('abort')) return true
  return false
}

function uniqueMailboxIds(...ids: (string | undefined | null)[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids) {
    const id = (raw ?? '').trim().toLowerCase()
    if (!HEX64.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

async function purgeOnce(opts: {
  recipient: string
  peerSender: string
  nonce: bigint
  variant: PurgeMailboxMessageVariant
  mailboxObjectId: string
}): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  const ctx = resolveDirectIotaSubmitContext({ requireRecipient: opts.recipient })
  if (!ctx.ok) return ctx

  try {
    const client = ctx.client
    const { mailboxObjectId } = ctx.snap.flags.useMailbox
      ? resolveDirectMailboxUsePrivateMoveCall({
          mailboxObjectId: opts.mailboxObjectId,
          serverMailboxId: ctx.snap.mailboxId,
        })
      : { mailboxObjectId: opts.mailboxObjectId }
    const mailboxCheck = await validateMessagingMailboxObjectForPackage(
      client,
      mailboxObjectId,
      ctx.snap.packageId,
      'any'
    )
    if (!mailboxCheck.ok) {
      return { ok: false, error: mailboxCheck.error }
    }
    const privateMailbox = mailboxCheck.kind === 'privatemailbox'

    const txb = buildPurgeMailboxMessageTransaction({
      packageId: ctx.snap.packageId,
      senderAddress: ctx.snap.senderAddress.trim(),
      mailboxObjectId,
      recipient: ctx.recipient!,
      peerSender: opts.peerSender,
      nonce: opts.nonce,
      variant: opts.variant,
      privateMailbox,
    })
    await attachGasPaymentForOwner(client, txb, ctx.snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer: ctx.signer })
    if (isDirectChainExecutionSuccess(out.digest, out.status)) {
      return { ok: true, digest: out.digest }
    }
    return { ok: false, error: `Chain-Status: ${out.status || 'kein Digest'}.` }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function tryPurgeMailboxMessageViaDirectIota(opts: {
  recipient: string
  peerSender: string
  nonce: string
  variant: PurgeMailboxMessageVariant
  mailboxObjectId?: string
  /** Weitere Mailbox-IDs bei Abort 10 (Shared + aktive Private). */
  mailboxCandidates?: string[]
}): Promise<{ ok: true; digest?: string; mailboxObjectId?: string } | { ok: false; error: string }> {
  if (!canTryDirectPurgeMessageSubmit()) {
    return { ok: false, error: 'Direkt-Purge: Session, RPC oder Ketten-IDs fehlen.' }
  }
  if (!canUseDirectEncryptedMailboxDrain()) {
    return { ok: false, error: 'Purge per Fullnode braucht Mailbox-Drain-Flags im Puls.' }
  }
  const ctx = resolveDirectIotaSubmitContext({ requireRecipient: opts.recipient })
  if (!ctx.ok) return ctx

  const peer = opts.peerSender.trim()
  let nonce: bigint
  try {
    nonce = BigInt(opts.nonce.trim())
  } catch {
    return { ok: false, error: 'Ungültige Nonce für Purge.' }
  }

  const candidates = uniqueMailboxIds(
    opts.mailboxObjectId,
    ...(opts.mailboxCandidates ?? []),
    readActiveSendMailboxObjectId(),
    ctx.snap.mailboxId
  )
  if (candidates.length === 0) {
    return { ok: false, error: 'Keine Mailbox-ID für Burn (Ketten-IDs / aktive Mailbox prüfen).' }
  }

  let lastErr = ''
  for (const mailboxObjectId of candidates) {
    const once = await purgeOnce({
      recipient: opts.recipient,
      peerSender: peer,
      nonce,
      variant: opts.variant,
      mailboxObjectId,
    })
    if (once.ok) return { ...once, mailboxObjectId }
    lastErr = once.error
    if (!isMailboxMsgMissingPurgeError(once.error)) {
      return once
    }
  }
  return {
    ok: false,
    error:
      lastErr ||
      'Nachricht in keiner bekannten Mailbox gefunden (Abort 10/43). Posteingang aktualisieren und erneut burnen.',
  }
}
