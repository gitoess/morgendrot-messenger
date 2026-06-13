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
import { base64ToUint8 } from '@morgendrot/shared/bytes-base64'
import { deriveAesGcmKey, deriveSharedSecret, encryptMessage } from '@morgendrot/shared/morgendrot-crypto'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  canUseDirectEncryptedMailboxDrain,
  getDirectMailboxChainSnapshot,
  type DirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getDirectIotaSessionSigner, getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { resolveDirectMailboxUsePrivateMoveCall } from '@/frontend/lib/direct-mailbox-object-kind'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'
import { syncActiveNetworkChainSnapshot } from '@/frontend/lib/active-network-chain-sync'
import { directIotaSignerMatchesIdentity } from '@/frontend/lib/direct-iota-signer-identity'
import { trimValidIotaAddress } from '@/frontend/lib/iota-address'
import { tryAutoRestoreDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-vault-unlock-sync'

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

export const canTryLiveEncryptedDirectEvent = (recipient: string) =>
  canTryLiveEncryptedDirect(recipient, 'event')

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
  if (isIotaRelayOnlyMode()) {
    return {
      ok: false,
      error:
        'Modus „Nur Morgendrot-API“: direkter IOTA-Upload (verschlüsselt) ist aus — in den Puls-Einstellungen auf „Direkt“ stellen.',
    }
  }
  if (!isDirectMailboxDrainEnabled()) {
    return { ok: false, error: 'Direkt-Mailbox-Drain ist aus.' }
  }
  syncActiveNetworkChainSnapshot()
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return { ok: false, error: 'Keine Direkt-RPC-URL (localStorage oder NEXT_PUBLIC_DIRECT_IOTA_RPC_URL).' }
  }
  const signer = getDirectIotaSessionSigner()
  const signerAddr = getDirectIotaSessionSignerAddress()
  if (!signer || !signerAddr) {
    return {
      ok: false,
      error: 'Kein Session-Signer — Tresor entsperren oder Mnemonic in den Einstellungen setzen (nur RAM).',
    }
  }
  const snap = getDirectMailboxChainSnapshot()
  if (!snap) {
    return {
      ok: false,
      error: 'Keine Ketten-IDs — Basis einmal verbinden oder Package/Mailbox/Absender in den Einstellungen speichern.',
    }
  }
  const recipientNorm = trimValidIotaAddress(recipient)
  if (!recipientNorm) {
    return { ok: false, error: 'Empfänger: gültige 0x-Adresse (64 Hex).' }
  }
  if (!canTryLiveEncryptedDirect(recipientNorm, mode)) {
    return {
      ok: false,
      error:
        mode === 'event'
          ? 'Direkt-verschlüsselt (Event) nicht bereit — Direkt-RPC, Drain, Session-Signer, Package/Absender und ECDH prüfen.'
          : 'Konfiguration passt nicht: Direkt-verschlüsselt nur mit aktiver Mailbox **ohne** Messenger-Credits (Flags aus letztem /api/status oder manuell geschätzt).',
    }
  }
  if (!directIotaSignerMatchesIdentity(signerAddr, snap.senderAddress)) {
    return {
      ok: false,
      error: 'Signer-Adresse stimmt nicht mit gespeichertem Absender (MY_ADDRESS) überein.',
    }
  }
  return { ok: true, rpc, signer, snap, client: createDirectIotaClient({ rpcUrl: rpc }) }
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
  opts: Pick<TrySubmitEncryptedMailboxViaDirectIotaFromPlaintextInput, 'plaintextUtf8' | 'peerPubRaw' | 'ecdhPrivateKey'>
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
  try {
    const sharedSecret = await deriveSharedSecret(opts.ecdhPrivateKey, opts.peerPubRaw)
    const aesKey = await deriveAesGcmKey(sharedSecret)
    const encrypted = await encryptMessage(aesKey, bodyForE2ee)
    const full = base64ToUint8(encrypted.ciphertext)
    const nonce = parsedNonce.nonce
    const ciphertext = new Uint8Array(full.subarray(0, -16))
    const iv = base64ToUint8(encrypted.iv)
    const tag = new Uint8Array(full.subarray(-16))
    return { ok: true, ciphertext, iv, tag, nonce }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
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
