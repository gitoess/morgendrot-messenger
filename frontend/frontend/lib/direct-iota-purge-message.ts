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

export function canTryDirectPurgeMessageSubmit(): boolean {
  return canTryDirectPurgeHandshakeSubmit()
}

export async function tryPurgeMailboxMessageViaDirectIota(opts: {
  recipient: string
  peerSender: string
  nonce: string
  variant: PurgeMailboxMessageVariant
  mailboxObjectId?: string
}): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
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

  try {
    const client = ctx.client
    const mbOverride = (opts.mailboxObjectId ?? readActiveSendMailboxObjectId() ?? '').trim()
    const { mailboxObjectId } = ctx.snap.flags.useMailbox
      ? resolveDirectMailboxUsePrivateMoveCall({
          mailboxObjectId: mbOverride || undefined,
          serverMailboxId: ctx.snap.mailboxId,
        })
      : { mailboxObjectId: ctx.snap.mailboxId }
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
      peerSender: peer,
      nonce,
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
