'use client'

import {
  attachGasPaymentForOwner,
  buildStoreTeamPlaintextBroadcastTransaction,
  createDirectIotaClient,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
  validateMessagingMailboxObjectForPackage,
} from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  canUseDirectPlaintextMailboxDrain,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import {
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'

function normalizeHexAddr(a: string): string {
  return a.trim().toLowerCase()
}

export function canTryLiveTeamBroadcastDirectMailbox(): boolean {
  if (isIotaRelayOnlyMode()) return false
  if (!isDirectMailboxDrainEnabled()) return false
  if (!getConfiguredDirectIotaRpcUrl()) return false
  if (!getDirectIotaSessionSigner() || !getDirectIotaSessionSignerAddress()) return false
  if (!getDirectMailboxChainSnapshot()) return false
  return canUseDirectPlaintextMailboxDrain()
}

export async function trySubmitTeamPlaintextBroadcastViaDirectIota(opts: {
  teamMailboxObjectId: string
  payloadUtf8: string
  nonce: bigint
}): Promise<{ ok: true; digest: string } | { ok: false; error: string }> {
  if (!canTryLiveTeamBroadcastDirectMailbox()) {
    return { ok: false, error: 'Direkt-Team-Broadcast nicht verfügbar (Drain/RPC/Signer/Flags).' }
  }
  const teamMb = opts.teamMailboxObjectId.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(teamMb)) {
    return { ok: false, error: 'Ungültige Team-Mailbox-Object-ID.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  const signer = getDirectIotaSessionSigner()
  const signerAddr = getDirectIotaSessionSignerAddress()
  const snap = getDirectMailboxChainSnapshot()
  if (!rpc || !signer || !signerAddr || !snap) {
    return { ok: false, error: 'Direkt-RPC/Signer/Snapshot fehlt.' }
  }
  if (normalizeHexAddr(signerAddr) !== normalizeHexAddr(snap.senderAddress)) {
    return { ok: false, error: 'Signer-Adresse stimmt nicht mit gespeichertem Absender überein.' }
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
    const txb = buildStoreTeamPlaintextBroadcastTransaction({
      packageId: snap.packageId,
      teamMailboxObjectId: teamMb,
      senderAddress: snap.senderAddress.trim(),
      plaintextUtf8: new TextEncoder().encode(opts.payloadUtf8),
      nonce: opts.nonce,
      ttlDays: snap.ttlDays,
    })
    await attachGasPaymentForOwner(client, txb, snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (isDirectChainExecutionSuccess(out.digest, out.status)) {
      return { ok: true, digest: out.digest! }
    }
    return {
      ok: false,
      error: `Chain-Status: ${out.status || 'kein Digest'}.`,
    }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
