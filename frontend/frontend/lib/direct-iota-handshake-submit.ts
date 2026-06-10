'use client'

/**
 * § H.15 B.2: Handshake (EcdhInit / HsKey) per Fullnode — PTB + Session-Signer im Browser.
 */

import {
  attachGasPaymentForOwner,
  buildStoreEcdhInitTransaction,
  createDirectIotaClient,
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
import { getDirectIotaSessionSigner, getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { resolveDirectMailboxUsePrivateMoveCall } from '@/frontend/lib/direct-mailbox-object-kind'
import {
  isDirectMailboxDrainEnabled,
  isIotaRelayOnlyMode,
} from '@/frontend/lib/direct-iota-plain-submit'
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'

function normalizeHexAddr(a: string): string {
  const t = a.trim().toLowerCase()
  return t.startsWith('0x') ? t : `0x${t}`
}

export function canUseDirectHandshakeChainFlags(): boolean {
  return canUseDirectEncryptedMailboxDrain()
}

/** Voraussetzungen für clientseitigen Handshake (ohne `/handshake`-API). */
export function canTryDirectHandshakeSubmit(): boolean {
  if (typeof window === 'undefined') return false
  return (
    !isIotaRelayOnlyMode() &&
    isDirectMailboxDrainEnabled() &&
    Boolean(getConfiguredDirectIotaRpcUrl()) &&
    Boolean(getDirectIotaSessionSigner()) &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    canUseDirectHandshakeChainFlags()
  )
}

export async function trySubmitHandshakeViaDirectIota(opts: {
  recipient: string
  /** M4b: aktive Private-/Team-Mailbox statt Shared-Snapshot. */
  mailboxObjectId?: string
}): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  if (isIotaRelayOnlyMode()) {
    return {
      ok: false,
      error: 'Modus „Nur Morgendrot-API“: direkter Handshake per Fullnode ist aus.',
    }
  }
  if (!isDirectMailboxDrainEnabled()) {
    return { ok: false, error: 'Direkt-Mailbox-Drain ist aus.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  const signer = getDirectIotaSessionSigner()
  const signerAddr = getDirectIotaSessionSignerAddress()
  if (!signer || !signerAddr) {
    return { ok: false, error: 'Kein Session-Signer — Mnemonic im Puls anwenden.' }
  }
  const snap = getDirectMailboxChainSnapshot()
  if (!snap) {
    return { ok: false, error: 'Keine Ketten-IDs (Package/Mailbox/Absender im Puls).' }
  }
  if (!canUseDirectHandshakeChainFlags()) {
    return {
      ok: false,
      error:
        'Handshake per Fullnode blockiert durch Ketten-Flags (Mailbox/Credits) — optional „Optimistische Flags“ in den Puls-Einstellungen aktivieren.',
    }
  }
  if (normalizeHexAddr(signerAddr) !== normalizeHexAddr(snap.senderAddress)) {
    return { ok: false, error: 'Signer-Adresse ≠ gespeicherter Absender.' }
  }
  const recipient = opts.recipient.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(recipient)) {
    return { ok: false, error: 'Empfänger: 0x + 64 Hex.' }
  }

  const pub = await exportDirectChatEcdhPublicKeyRawBase64()
  if (!pub.ok) {
    return {
      ok: false,
      error: `${pub.error} (Peering-QR oder Handshake von Partner mit Basis kann Peer-Pub liefern.)`,
    }
  }

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const mbOverride = (opts.mailboxObjectId ?? readActiveSendMailboxObjectId() ?? '').trim()
    let mailboxObjectId: string | undefined
    let privateMailbox = false
    if (snap.flags.useMailbox) {
      const resolved = resolveDirectMailboxUsePrivateMoveCall({
        mailboxObjectId: mbOverride || undefined,
        serverMailboxId: snap.mailboxId,
      })
      mailboxObjectId = resolved.mailboxObjectId
      privateMailbox = resolved.privateMailbox
    }

    const txb = buildStoreEcdhInitTransaction({
      packageId: snap.packageId,
      senderAddress: snap.senderAddress.trim(),
      recipientAddress: recipient,
      pubKeyRaw: base64ToUint8(pub.b64),
      nonce: BigInt(Date.now()),
      ttlDays: snap.ttlDays,
      mailboxObjectId,
      privateMailbox,
    })
    await attachGasPaymentForOwner(client, txb, snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
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
