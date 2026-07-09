'use client'

/**
 * Verschlüsselte Mailbox/Event per Fullnode — gleiches Muster wie Klartext (`direct-iota-plain-submit`).
 */
import type { Signer } from '@iota/iota-sdk/cryptography'
import type { Transaction } from '@iota/iota-sdk/transactions'
import {
  attachGasPaymentForOwner,
  buildSendEncryptedEventTransaction,
  buildStoreEncryptedMailboxTransaction,
  createDirectIotaClient,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
  validateMessagingMailboxObjectForPackage,
} from '@morgendrot/core/iota'
import { parseMailboxOutNonceMarker } from '@morgendrot/core'
import { encryptIotaPeerSessionMessage } from '@morgendrot/shared/morgendrot-crypto-session-wire'
import { resolveDirectIotaSubmitContext } from '@/frontend/lib/direct-iota-submit-context'
import {
  canUseDirectEncryptedMailboxDrain,
  getDirectChainFieldIdsFromLs,
  getDirectMailboxChainSnapshot,
  type DirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getSendKeyEpochForRecipient } from '@/frontend/lib/direct-session-keys-archive'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { resolveDirectMailboxUsePrivateMoveCall } from '@/frontend/lib/direct-mailbox-object-kind'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'
import { tryAutoRestoreDirectIotaSessionSigner, tryAutoRestoreDirectIotaSessionSignerAsync } from '@/frontend/lib/direct-iota-vault-unlock-sync'

const MESSAGING_MAX_PLAINTEXT_UTF8_BYTES = 16000

type EncryptedPersistenceMode = 'event' | 'mailbox'

function encryptedBaseReady(recipientTrimmed: string): boolean {
  const r = recipientTrimmed.trim()
  if (!r) return false
  return (
    !isIotaRelayOnlyMode() &&
    isDirectMailboxDrainEnabled() &&
    Boolean(getConfiguredDirectIotaRpcUrl()) &&
    Boolean(getDirectIotaSessionSigner()) &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    getDirectChatEcdhMaterialForRecipient(r) != null
  )
}

/** Live-Send (Composer, verschlüsselt) — Event oder Mailbox. */
export function canTryLiveEncryptedDirect(
  recipientTrimmed: string,
  mode: EncryptedPersistenceMode
): boolean {
  if (typeof window === 'undefined') return false
  tryAutoRestoreDirectIotaSessionSigner()
  if (!encryptedBaseReady(recipientTrimmed)) return false
  if (mode === 'mailbox' && !canUseDirectEncryptedMailboxDrain()) return false
  return true
}

export const canTryLiveEncryptedDirectMailbox = (recipient: string) =>
  canTryLiveEncryptedDirect(recipient, 'mailbox')

export type TrySubmitEncryptedMailboxViaDirectIotaInput = {
  recipient: string
  ciphertext: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  nonce: bigint
  mailboxObjectId?: string
}

type EncryptedSubmitContext =
  | {
      ok: true
      rpc: string
      signer: Signer
      snap: DirectMailboxChainSnapshot
      client: ReturnType<typeof createDirectIotaClient>
    }
  | { ok: false; error: string }

async function resolveEncryptedDirectSubmitContext(
  recipient: string,
  mode: EncryptedPersistenceMode
): Promise<EncryptedSubmitContext> {
  await tryAutoRestoreDirectIotaSessionSignerAsync()
  const base = resolveDirectIotaSubmitContext({
    relayBlockedMessage:
      'Modus „Nur Morgendrot-API“: direkter IOTA-Upload (verschlüsselt) ist aus — in den Puls-Einstellungen auf „Direkt“ stellen.',
    requireRecipient: recipient,
  })
  if (!base.ok) return base
  if (!canTryLiveEncryptedDirect(base.recipient!, mode)) {
    return {
      ok: false,
      error:
        mode === 'event'
          ? 'Direkt-verschlüsselt (Event) nicht bereit — Direkt-RPC, Drain, Session-Signer, Package/Absender und ECDH prüfen.'
          : 'Konfiguration passt nicht: Direkt-verschlüsselt nur mit aktiver Mailbox **ohne** Messenger-Credits (Flags aus letztem /api/status oder manuell geschätzt).',
    }
  }
  return {
    ok: true,
    rpc: base.rpc,
    signer: base.signer,
    snap: base.snap,
    client: base.client,
  }
}

async function executeEncryptedDirectTransaction(
  ctx: Extract<EncryptedSubmitContext, { ok: true }>,
  txb: Transaction
): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  try {
    await attachGasPaymentForOwner(ctx.client, txb, ctx.snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({
      client: ctx.client,
      transaction: txb,
      signer: ctx.signer,
    })
    if (isDirectChainExecutionSuccess(out.digest, out.status)) {
      return { ok: true, digest: out.digest }
    }
    return {
      ok: false,
      error: `Chain-Status: ${out.status || 'kein Digest'} — im Explorer prüfen, ob die TX trotzdem existiert.`,
    }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

async function buildEncryptedDirectTransaction(
  ctx: Extract<EncryptedSubmitContext, { ok: true }>,
  opts: TrySubmitEncryptedMailboxViaDirectIotaInput,
  mode: EncryptedPersistenceMode
): Promise<{ ok: true; txb: Transaction } | { ok: false; error: string }> {
  const recipient = opts.recipient.trim()
  if (mode === 'event') {
    return {
      ok: true,
      txb: buildSendEncryptedEventTransaction({
        packageId: ctx.snap.packageId,
        senderAddress: ctx.snap.senderAddress.trim(),
        recipientAddress: recipient,
        ciphertext: opts.ciphertext,
        iv: opts.iv,
        tag: opts.tag,
        nonce: opts.nonce,
      }),
    }
  }
  const { mailboxObjectId } = resolveDirectMailboxUsePrivateMoveCall({
    mailboxObjectId: opts.mailboxObjectId,
    serverMailboxId: ctx.snap.mailboxId,
  })
  const mailboxCheck = await validateMessagingMailboxObjectForPackage(
    ctx.client,
    mailboxObjectId,
    ctx.snap.packageId,
    'any'
  )
  if (!mailboxCheck.ok) {
    return { ok: false, error: mailboxCheck.error }
  }
  return {
    ok: true,
    txb: buildStoreEncryptedMailboxTransaction({
      packageId: ctx.snap.packageId,
      mailboxObjectId,
      senderAddress: ctx.snap.senderAddress.trim(),
      recipientAddress: recipient,
      ciphertext: opts.ciphertext,
      iv: opts.iv,
      tag: opts.tag,
      nonce: opts.nonce,
      ttlDays: ctx.snap.ttlDays,
      privateMailbox: mailboxCheck.kind === 'privatemailbox',
    }),
  }
}

async function trySubmitEncryptedViaDirectIota(
  opts: TrySubmitEncryptedMailboxViaDirectIotaInput,
  mode: EncryptedPersistenceMode
): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  const ctx = await resolveEncryptedDirectSubmitContext(opts.recipient, mode)
  if (!ctx.ok) return ctx
  const txb = await buildEncryptedDirectTransaction(ctx, opts, mode)
  if (!txb.ok) return txb
  return executeEncryptedDirectTransaction(ctx, txb.txb)
}

export async function trySubmitEncryptedMailboxViaDirectIota(
  opts: TrySubmitEncryptedMailboxViaDirectIotaInput
): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  return trySubmitEncryptedViaDirectIota(opts, 'mailbox')
}

export async function trySubmitEncryptedEventViaDirectIota(
  opts: TrySubmitEncryptedMailboxViaDirectIotaInput
): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  return trySubmitEncryptedViaDirectIota(opts, 'event')
}

export type TrySubmitEncryptedMailboxViaDirectIotaFromPlaintextInput = {
  recipient: string
  plaintextUtf8: string
  peerPubRaw: Uint8Array
  ecdhPrivateKey: CryptoKey
  mailboxObjectId?: string
  messagingPersistenceMode?: EncryptedPersistenceMode
}

async function encryptPlaintextForDirectSubmit(
  opts: Pick<
    TrySubmitEncryptedMailboxViaDirectIotaFromPlaintextInput,
    'plaintextUtf8' | 'peerPubRaw' | 'ecdhPrivateKey' | 'recipient'
  >
): Promise<
  | { ok: true; ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array; nonce: bigint }
  | { ok: false; error: string }
> {
  const parsedNonce = parseMailboxOutNonceMarker(opts.plaintextUtf8)
  if (!parsedNonce) {
    return { ok: false, error: 'Verschlüsselter Send: Nonce-Marker im Wire-Format fehlt.' }
  }
  const bodyForE2ee = parsedNonce.rest
  const msgUtf8 = new TextEncoder().encode(bodyForE2ee).length
  if (msgUtf8 > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
    return {
      ok: false,
      error: `Nachricht zu lang (${msgUtf8} B UTF-8, max. ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES}).`,
    }
  }
  const snap = getDirectMailboxChainSnapshot()
  const myAddress = (snap?.senderAddress ?? getDirectChainFieldIdsFromLs().senderAddress).trim()
  if (!myAddress) {
    return { ok: false, error: 'Verschlüsselter Send: MY_ADDRESS unbekannt — Status aktualisieren.' }
  }
  try {
    const nonce = parsedNonce.nonce
    const packed = await encryptIotaPeerSessionMessage({
      plaintext: bodyForE2ee,
      myAddress,
      peerAddress: opts.recipient.trim(),
      myPrivKey: opts.ecdhPrivateKey,
      peerPubRaw: opts.peerPubRaw,
      msgId: String(nonce),
      keyEpoch: getSendKeyEpochForRecipient(opts.recipient),
    })
    return { ok: true, ciphertext: packed.ciphertext, iv: packed.iv, tag: packed.tag, nonce }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}

export async function encryptPlaintextWireForRecipient(
  opts: Pick<
    TrySubmitEncryptedMailboxViaDirectIotaFromPlaintextInput,
    'plaintextUtf8' | 'peerPubRaw' | 'ecdhPrivateKey' | 'recipient'
  >
): Promise<
  | { ok: true; ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array; nonce: bigint }
  | { ok: false; error: string }
> {
  return encryptPlaintextForDirectSubmit(opts)
}

export async function trySubmitEncryptedMailboxViaDirectIotaFromPlaintext(
  opts: TrySubmitEncryptedMailboxViaDirectIotaFromPlaintextInput
): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  const enc = await encryptPlaintextForDirectSubmit(opts)
  if (!enc.ok) return enc
  const mode: EncryptedPersistenceMode = opts.messagingPersistenceMode === 'mailbox' ? 'mailbox' : 'event'
  return trySubmitEncryptedViaDirectIota(
    {
      recipient: opts.recipient,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      tag: enc.tag,
      nonce: enc.nonce,
      mailboxObjectId: opts.mailboxObjectId,
    },
    mode
  )
}
