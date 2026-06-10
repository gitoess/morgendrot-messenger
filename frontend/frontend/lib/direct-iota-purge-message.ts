'use client'

import {
  attachGasPaymentForOwner,
  buildPurgeMailboxMessageTransaction,
  createDirectIotaClient,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
  type PurgeMailboxMessageVariant,
} from '@morgendrot/core/iota'
import {
  canUseDirectEncryptedMailboxDrain,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { canTryDirectPurgeHandshakeSubmit } from '@/frontend/lib/direct-iota-purge-handshake'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSigner, getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
import { resolveDirectMailboxUsePrivateMoveCall } from '@/frontend/lib/direct-mailbox-object-kind'

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
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  const signer = getDirectIotaSessionSigner()
  const signerAddr = getDirectIotaSessionSignerAddress()
  if (!signer || !signerAddr) {
    return { ok: false, error: 'Kein Session-Signer — Mnemonic im Puls anwenden.' }
  }
  const snap = getDirectMailboxChainSnapshot()
  if (!snap) return { ok: false, error: 'Keine Ketten-IDs (Snapshot).' }
  if (!canUseDirectEncryptedMailboxDrain()) {
    return { ok: false, error: 'Purge per Fullnode braucht Mailbox-Drain-Flags im Puls.' }
  }

  const recipient = opts.recipient.trim()
  const peer = opts.peerSender.trim()
  let nonce: bigint
  try {
    nonce = BigInt(opts.nonce.trim())
  } catch {
    return { ok: false, error: 'Ungültige Nonce für Purge.' }
  }

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const mbOverride = (opts.mailboxObjectId ?? readActiveSendMailboxObjectId() ?? '').trim()
    const { mailboxObjectId, privateMailbox } = snap.flags.useMailbox
      ? resolveDirectMailboxUsePrivateMoveCall({
          mailboxObjectId: mbOverride || undefined,
          serverMailboxId: snap.mailboxId,
        })
      : { mailboxObjectId: snap.mailboxId, privateMailbox: false }

    const txb = buildPurgeMailboxMessageTransaction({
      packageId: snap.packageId,
      senderAddress: snap.senderAddress.trim(),
      mailboxObjectId,
      recipient,
      peerSender: peer,
      nonce,
      variant: opts.variant,
      privateMailbox,
    })
    await attachGasPaymentForOwner(client, txb, snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (isDirectChainExecutionSuccess(out.digest, out.status)) {
      return { ok: true, digest: out.digest }
    }
    return { ok: false, error: `Chain-Status: ${out.status || 'kein Digest'}.` }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
