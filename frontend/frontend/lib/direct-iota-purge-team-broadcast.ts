'use client'

import {
  attachGasPaymentForOwner,
  buildPurgeTeamPlaintextBroadcastTransaction,
  createDirectIotaClient,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
  validateMessagingMailboxObjectForPackage,
} from '@morgendrot/core/iota'
import {
  canUseDirectEncryptedMailboxDrain,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { canTryDirectPurgeHandshakeSubmit } from '@/frontend/lib/direct-iota-purge-handshake'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSigner, getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'

export function canTryDirectPurgeTeamBroadcastSubmit(): boolean {
  return canTryDirectPurgeHandshakeSubmit()
}

export async function tryPurgeTeamPlaintextBroadcastViaDirectIota(opts: {
  teamMailboxObjectId: string
  broadcastSender: string
  nonce: string
}): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  if (!canTryDirectPurgeTeamBroadcastSubmit()) {
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

  const teamMb = opts.teamMailboxObjectId.trim()
  const broadcastSender = opts.broadcastSender.trim()
  let nonce: bigint
  try {
    nonce = BigInt(opts.nonce.trim())
  } catch {
    return { ok: false, error: 'Ungültige Nonce für Purge.' }
  }

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const mailboxCheck = await validateMessagingMailboxObjectForPackage(
      client,
      teamMb,
      snap.packageId,
      'mailbox'
    )
    if (!mailboxCheck.ok) {
      return { ok: false, error: mailboxCheck.error }
    }
    const txb = buildPurgeTeamPlaintextBroadcastTransaction({
      packageId: snap.packageId,
      senderAddress: snap.senderAddress.trim(),
      teamMailboxObjectId: teamMb,
      broadcastSender,
      nonce,
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
