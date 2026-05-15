'use client'

/**
 * Verschlüsselte Mailbox (`store_encrypted_message`) per Fullnode — gleiches Muster wie Klartext (`direct-iota-plain-submit`).
 * ECDH P-256 + AES-GCM wie Server (`messenger-chain-wrap`); Schlüssel kommen vom Caller (noch kein Puls-UI für Chat-ECDH).
 */

import {
  attachGasPaymentForOwner,
  buildStoreEncryptedMailboxTransaction,
  createDirectIotaClient,
  signAndExecuteTransactionWithSigner,
} from '@morgendrot/core/iota'
import { parseMailboxOutNonceMarker } from '@morgendrot/core'
import { base64ToUint8 } from '@morgendrot/shared/bytes-base64'
import { deriveAesGcmKey, deriveSharedSecret, encryptMessage } from '@morgendrot/shared/morgendrot-crypto'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  canUseDirectEncryptedMailboxDrain,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getDirectIotaSessionSigner, getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import {
  isDirectMailboxDrainEnabled,
  isIotaRelayOnlyMode,
} from '@/frontend/lib/direct-iota-plain-submit'

/** Konsistent mit Server-Default `MESSENGER_MAX_PLAINTEXT_UTF8_BYTES` (16000). */
const MESSAGING_MAX_PLAINTEXT_UTF8_BYTES = 16000

/** Live-Send (Composer, verschlüsselt): Direct-Mailbox möglich — ECDH-Material für Empfänger nötig. */
export function canTryLiveEncryptedDirectMailbox(recipientTrimmed: string): boolean {
  if (typeof window === 'undefined') return false
  const r = recipientTrimmed.trim()
  if (!r) return false
  return (
    !isIotaRelayOnlyMode() &&
    isDirectMailboxDrainEnabled() &&
    Boolean(getConfiguredDirectIotaRpcUrl()) &&
    Boolean(getDirectIotaSessionSigner()) &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    canUseDirectEncryptedMailboxDrain() &&
    getDirectChatEcdhMaterialForRecipient(r) != null
  )
}

function normalizeHexAddr(a: string): string {
  const t = a.trim().toLowerCase()
  return t.startsWith('0x') ? t : `0x${t}`
}

export type TrySubmitEncryptedMailboxViaDirectIotaInput = {
  recipient: string
  ciphertext: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  nonce: bigint
  /** M4b: Kontakt-Mailbox statt Snapshot-Mailbox. */
  mailboxObjectId?: string
}

/**
 * Bereits verschlüsselte Felder (wie nach `encryptMessage` + Split in `sendEncryptedMessage`).
 */
export async function trySubmitEncryptedMailboxViaDirectIota(
  opts: TrySubmitEncryptedMailboxViaDirectIotaInput
): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  if (isIotaRelayOnlyMode()) {
    return {
      ok: false,
      error:
        'Modus „Nur Morgendrot-API“: direkter IOTA-Upload (verschlüsselte Mailbox) ist aus — in den Puls-Einstellungen auf „Direkt“ stellen.',
    }
  }
  if (!isDirectMailboxDrainEnabled()) {
    return { ok: false, error: 'Direkt-Mailbox-Drain ist aus.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return { ok: false, error: 'Keine Direkt-RPC-URL (localStorage oder NEXT_PUBLIC_DIRECT_IOTA_RPC_URL).' }
  }
  const signer = getDirectIotaSessionSigner()
  const signerAddr = getDirectIotaSessionSignerAddress()
  if (!signer || !signerAddr) {
    return { ok: false, error: 'Kein Session-Signer — Mnemonic/Secret in den Einstellungen setzen (nur RAM).' }
  }
  const snap = getDirectMailboxChainSnapshot()
  if (!snap) {
    return {
      ok: false,
      error: 'Keine Ketten-IDs — Basis einmal verbinden oder Package/Mailbox/Absender in den Einstellungen speichern.',
    }
  }
  if (!canUseDirectEncryptedMailboxDrain()) {
    return {
      ok: false,
      error:
        'Konfiguration passt nicht: Direkt-verschlüsselt nur mit aktiver Mailbox **ohne** Messenger-Credits (Flags aus letztem /api/status oder manuell geschätzt).',
    }
  }
  if (normalizeHexAddr(signerAddr) !== normalizeHexAddr(snap.senderAddress)) {
    return {
      ok: false,
      error: 'Signer-Adresse stimmt nicht mit gespeichertem Absender (MY_ADDRESS) überein.',
    }
  }
  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const mbOverride = (opts.mailboxObjectId ?? '').trim()
    const mailboxObjectId =
      /^0x[a-fA-F0-9]{64}$/i.test(mbOverride) && mbOverride.toLowerCase() !== snap.mailboxId.toLowerCase()
        ? mbOverride
        : snap.mailboxId
    const txb = buildStoreEncryptedMailboxTransaction({
      packageId: snap.packageId,
      mailboxObjectId,
      senderAddress: snap.senderAddress.trim(),
      recipientAddress: opts.recipient.trim(),
      ciphertext: opts.ciphertext,
      iv: opts.iv,
      tag: opts.tag,
      nonce: opts.nonce,
      ttlDays: snap.ttlDays,
    })
    await attachGasPaymentForOwner(client, txb, snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    const st = (out.status || '').toLowerCase()
    if (st && st !== 'success') {
      return { ok: false, error: `Chain-Status: ${out.status || '?'}` }
    }
    return { ok: true, digest: out.digest }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export type TrySubmitEncryptedMailboxViaDirectIotaFromPlaintextInput = {
  recipient: string
  /** Wire inkl. optional `[[MORG_MAILBOX_NONCE_V1:…]]` — wie an `/send`. */
  plaintextUtf8: string
  peerPubRaw: Uint8Array
  /** P-256 ECDH private key (Web Crypto), **nicht** der IOTA-Ed25519-Signer. */
  ecdhPrivateKey: CryptoKey
  mailboxObjectId?: string
}

/**
 * Verschlüsselt lokal (ECDH + AES-GCM) und reicht `store_encrypted_message` an die Kette.
 */
export async function trySubmitEncryptedMailboxViaDirectIotaFromPlaintext(
  opts: TrySubmitEncryptedMailboxViaDirectIotaFromPlaintextInput
): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  const parsedNonce = parseMailboxOutNonceMarker(opts.plaintextUtf8)
  const bodyForE2ee = parsedNonce ? parsedNonce.rest : opts.plaintextUtf8
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
    const nonce = parsedNonce ? parsedNonce.nonce : BigInt(Date.now())
    const ciphertext = new Uint8Array(full.subarray(0, -16))
    const iv = base64ToUint8(encrypted.iv)
    const tag = new Uint8Array(full.subarray(-16))
    return trySubmitEncryptedMailboxViaDirectIota({
      recipient: opts.recipient,
      ciphertext,
      iv,
      tag,
      nonce,
      mailboxObjectId: opts.mailboxObjectId,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
