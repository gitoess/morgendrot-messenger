'use client'

/**
 * § H.15 B.2: Handshake (EcdhInit / HsKey) per Fullnode — PTB + Session-Signer im Browser.
 */

import {
  attachGasPaymentForOwner,
  buildStoreEcdhInitTransaction,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
} from '@morgendrot/core/iota'
import { base64ToUint8 } from '@morgendrot/shared/bytes-base64'
import { exportDirectChatEcdhPublicKeyRawBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import {
  canUseDirectEncryptedMailboxDrain,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'
import { resolveDirectMailboxUsePrivateMoveCall } from '@/frontend/lib/direct-mailbox-object-kind'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
import { resolveDirectIotaSubmitContext } from '@/frontend/lib/direct-iota-submit-context'

export function canTryDirectHandshakeSubmit(): boolean {
  if (typeof window === 'undefined') return false
  return (
    !isIotaRelayOnlyMode() &&
    isDirectMailboxDrainEnabled() &&
    Boolean(getConfiguredDirectIotaRpcUrl()) &&
    Boolean(getDirectIotaSessionSigner()) &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    canUseDirectEncryptedMailboxDrain()
  )
}

export async function trySubmitHandshakeViaDirectIota(opts: {
  recipient: string
  mailboxObjectId?: string
}): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  if (!canUseDirectEncryptedMailboxDrain()) {
    return {
      ok: false,
      error:
        'Handshake per Fullnode blockiert durch Ketten-Flags (Mailbox/Credits) — optional „Optimistische Flags“ in den Puls-Einstellungen aktivieren.',
    }
  }
  const ctx = resolveDirectIotaSubmitContext({
    relayBlockedMessage: 'Modus „Nur Morgendrot-API“: direkter Handshake per Fullnode ist aus.',
    requireRecipient: opts.recipient,
  })
  if (!ctx.ok) return ctx

  const pub = await exportDirectChatEcdhPublicKeyRawBase64()
  if (!pub.ok) {
    return {
      ok: false,
      error: `${pub.error} (Peering-QR oder Handshake von Partner mit Basis kann Peer-Pub liefern.)`,
    }
  }

  try {
    const client = ctx.client
    const mbOverride = (opts.mailboxObjectId ?? readActiveSendMailboxObjectId() ?? '').trim()
    let mailboxObjectId: string | undefined
    let privateMailbox = false
    if (ctx.snap.flags.useMailbox) {
      const resolved = resolveDirectMailboxUsePrivateMoveCall({
        mailboxObjectId: mbOverride || undefined,
        serverMailboxId: ctx.snap.mailboxId,
      })
      mailboxObjectId = resolved.mailboxObjectId
      privateMailbox = resolved.privateMailbox
    }

    const txb = buildStoreEcdhInitTransaction({
      packageId: ctx.snap.packageId,
      senderAddress: ctx.snap.senderAddress.trim(),
      recipientAddress: ctx.recipient!,
      pubKeyRaw: base64ToUint8(pub.b64),
      nonce: BigInt(Date.now()),
      ttlDays: ctx.snap.ttlDays,
      mailboxObjectId,
      privateMailbox,
    })
    await attachGasPaymentForOwner(client, txb, ctx.snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer: ctx.signer })
    if (isDirectChainExecutionSuccess(out.digest, out.status)) {
      return { ok: true, digest: out.digest }
    }
    return {
      ok: false,
      error: `Chain-Status: ${out.status || 'kein Digest'}.`,
    }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
