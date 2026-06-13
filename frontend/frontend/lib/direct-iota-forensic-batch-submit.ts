'use client'

import {
  attachGasPaymentForOwner,
  buildStoreEncryptedMailboxBatchTransaction,
  buildStorePlaintextMailboxBatchTransaction,
  createDirectIotaClient,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
  validateMessagingMailboxObjectForPackage,
} from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import {
  canTryLivePlaintextDirectMailbox,
  isIotaRelayOnlyMode,
} from '@/frontend/lib/direct-iota-plain-submit'
import {
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { resolveDirectMailboxUsePrivateMoveCall } from '@/frontend/lib/direct-mailbox-object-kind'
import { nextChainMessageNonceU64 } from '@/frontend/lib/api/offline-queue'
import type { ForensicBatchTxPlan } from '@/frontend/lib/einsatz-forensic-batch-entry'
import { getDirectChatEcdhMaterialForRecipient, ensureSelfForensicEcdhMaterial } from '@/frontend/lib/direct-chat-ecdh-session'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'
import { encryptForensicWireToMailboxItem } from '@morgendrot/core/forensic-batch'

export type SubmitForensicBatchTxResult =
  | { ok: true; digest?: string; messageCount: number }
  | { ok: false; error: string }

export async function trySubmitForensicBatchTxViaDirectIota(opts: {
  plan: ForensicBatchTxPlan
  recipientAddress: string
  mailboxObjectId?: string
}): Promise<SubmitForensicBatchTxResult> {
  if (isIotaRelayOnlyMode()) {
    return { ok: false, error: 'Nur Relay-Modus — Batch-Archiv braucht Direkt-RPC + Session-Signer.' }
  }
  const recipient = opts.recipientAddress.trim()
  if (opts.plan.mode === 'encrypted') {
    const signerAddrEarly = getDirectIotaSessionSignerAddress()
    if (
      signerAddrEarly &&
      recipient.toLowerCase() === signerAddrEarly.toLowerCase() &&
      !getDirectChatEcdhMaterialForRecipient(recipient)
    ) {
      const selfEcdh = await ensureSelfForensicEcdhMaterial(recipient)
      if (!selfEcdh.ok) {
        return { ok: false, error: `Self-ECDH für verschlüsseltes Archiv: ${selfEcdh.error}` }
      }
    }
    if (!canTryLiveEncryptedDirectMailbox(recipient)) {
      return {
        ok: false,
        error:
          'Verschlüsseltes Batch: Direkt-RPC + ECDH-Material für den Archiv-Empfänger nötig (Handshake / Puls-ECDH).',
      }
    }
  } else if (!canTryLivePlaintextDirectMailbox()) {
    return {
      ok: false,
      error: 'Direkt-Mailbox nicht bereit (RPC, Signer, Ketten-IDs, Drain-Schalter).',
    }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  const signer = getDirectIotaSessionSigner()
  const signerAddr = getDirectIotaSessionSignerAddress()
  const snap = getDirectMailboxChainSnapshot()
  if (!rpc || !signer || !signerAddr || !snap) {
    return { ok: false, error: 'RPC, Signer oder Ketten-Snapshot fehlt.' }
  }
  if (recipient.toLowerCase() !== signerAddr.trim().toLowerCase()) {
    return { ok: false, error: 'Forensic-Batch-Archiv: Empfänger muss die eigene Adresse (MY_ADDRESS) sein.' }
  }
  if (!opts.plan.items.length) {
    return { ok: false, error: 'Leerer Batch-Plan.' }
  }
  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const { mailboxObjectId } = resolveDirectMailboxUsePrivateMoveCall({
      mailboxObjectId: opts.mailboxObjectId,
      serverMailboxId: snap.mailboxId,
    })
    const mailboxCheck = await validateMessagingMailboxObjectForPackage(
      client,
      mailboxObjectId,
      snap.packageId,
      'any'
    )
    if (!mailboxCheck.ok) return { ok: false, error: mailboxCheck.error }
    const privateMailbox = mailboxCheck.kind === 'privatemailbox'
    let nonce = nextChainMessageNonceU64()

    let txb
    if (opts.plan.mode === 'encrypted') {
      const material = getDirectChatEcdhMaterialForRecipient(recipient)
      if (!material) {
        return { ok: false, error: 'ECDH-Material für Archiv-Empfänger fehlt.' }
      }
      const encItems = []
      for (const item of opts.plan.items) {
        const n = nonce
        nonce = nonce + 1n
        const enc = await encryptForensicWireToMailboxItem(item.wireUtf8, n, material)
        if ('error' in enc) return { ok: false, error: enc.error }
        encItems.push(enc)
      }
      txb = buildStoreEncryptedMailboxBatchTransaction({
        packageId: snap.packageId,
        mailboxObjectId,
        senderAddress: snap.senderAddress.trim(),
        recipientAddress: recipient,
        ttlDays: snap.ttlDays,
        privateMailbox,
        items: encItems,
      })
    } else {
      const items = opts.plan.items.map((item) => {
        const n = nonce
        nonce = nonce + 1n
        return {
          plaintextUtf8: new TextEncoder().encode(item.wireUtf8),
          nonce: n,
        }
      })
      txb = buildStorePlaintextMailboxBatchTransaction({
        packageId: snap.packageId,
        mailboxObjectId,
        senderAddress: snap.senderAddress.trim(),
        recipientAddress: recipient,
        ttlDays: snap.ttlDays,
        privateMailbox,
        stored: snap.flags.mailboxStorePlaintext === true,
        items,
      })
    }

    await attachGasPaymentForOwner(client, txb, snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    if (isDirectChainExecutionSuccess(out.digest, out.status)) {
      return { ok: true, digest: out.digest, messageCount: opts.plan.items.length }
    }
    return {
      ok: false,
      error: `Chain-Status: ${out.status || 'kein Digest'}.`,
    }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
