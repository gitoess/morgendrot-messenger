'use client'

/**
 * Diskret / Stealth-Mailbox: Ciphertext in Haupt-Mailbox unter `slot_tag` (kein Empfänger-Index).
 * Nur Direct-IOTA (kein `/api`-Relay). Call-Package ≠ Stamm-PACKAGE_ID.
 */
import type { Signer } from '@iota/iota-sdk/cryptography'
import type { Transaction } from '@iota/iota-sdk/transactions'
import {
  attachGasPaymentForOwner,
  buildStoreStealthEntryTransaction,
  createDirectIotaClient,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
  validateMessagingMailboxObjectForPackage,
} from '@morgendrot/core/iota'
import { deriveSharedSecret } from '@morgendrot/shared/morgendrot-crypto'
import { resolveDirectIotaSubmitContext } from '@/frontend/lib/direct-iota-submit-context'
import {
  canUseDirectEncryptedMailboxDrain,
  getDirectMailboxChainSnapshot,
  type DirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  tryAutoRestoreDirectIotaSessionSigner,
  tryAutoRestoreDirectIotaSessionSignerAsync,
} from '@/frontend/lib/direct-iota-vault-unlock-sync'
import { encryptPlaintextWireForRecipient } from '@/frontend/lib/direct-iota-encrypted-submit'
import { getStealthCallPackageId } from '@/frontend/lib/stealth-call-package'
import {
  deriveStealthDeleteCommit,
  deriveStealthDeleteSecret,
  deriveStealthSlotTag,
  stealthEpochHourUtc,
} from '@/frontend/lib/stealth-slot-tag'
import { readDiskretSendEnabled } from '@/frontend/lib/diskret-send-pref'

type StealthSubmitContext =
  | {
      ok: true
      rpc: string
      signer: Signer
      snap: DirectMailboxChainSnapshot
      client: ReturnType<typeof createDirectIotaClient>
    }
  | { ok: false; error: string }

function stealthBaseReady(recipientTrimmed: string): boolean {
  const r = recipientTrimmed.trim()
  if (!r) return false
  return (
    !isIotaRelayOnlyMode() &&
    isDirectMailboxDrainEnabled() &&
    Boolean(getConfiguredDirectIotaRpcUrl()) &&
    Boolean(getDirectIotaSessionSigner()) &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    getDirectChatEcdhMaterialForRecipient(r) != null &&
    canUseDirectEncryptedMailboxDrain()
  )
}

/** Live-Send Diskret — Direct + ECDH + Haupt-Mailbox. */
export function canTryLiveStealthDirect(recipientTrimmed: string): boolean {
  if (typeof window === 'undefined') return false
  if (!readDiskretSendEnabled()) return false
  tryAutoRestoreDirectIotaSessionSigner()
  return stealthBaseReady(recipientTrimmed)
}

async function resolveStealthDirectSubmitContext(recipient: string): Promise<StealthSubmitContext> {
  await tryAutoRestoreDirectIotaSessionSignerAsync()
  const base = resolveDirectIotaSubmitContext({
    relayBlockedMessage:
      'Modus „Nur Morgendrot-API“: Diskret braucht Direkt-IOTA — in den Puls-Einstellungen auf „Direkt“ stellen.',
    requireRecipient: recipient,
  })
  if (!base.ok) return base
  if (!canTryLiveStealthDirect(base.recipient!)) {
    return {
      ok: false,
      error:
        'Diskret nicht bereit — Opt-in an, Direkt-RPC, Drain, Session-Signer, Ketten-IDs und ECDH-Handshake prüfen.',
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

export type TrySubmitStealthMailboxViaDirectIotaFromPlaintextInput = {
  recipient: string
  plaintextUtf8: string
  peerPubRaw: Uint8Array
  ecdhPrivateKey: CryptoKey
  /** Ignoriert — Diskret erzwingt Haupt-Mailbox aus Snapshot. */
  mailboxObjectId?: string
}

export async function trySubmitStealthMailboxViaDirectIotaFromPlaintext(
  opts: TrySubmitStealthMailboxViaDirectIotaFromPlaintextInput
): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  const ctx = await resolveStealthDirectSubmitContext(opts.recipient)
  if (!ctx.ok) return ctx

  const enc = await encryptPlaintextWireForRecipient({
    recipient: opts.recipient,
    plaintextUtf8: opts.plaintextUtf8,
    peerPubRaw: opts.peerPubRaw,
    ecdhPrivateKey: opts.ecdhPrivateKey,
  })
  if (!enc.ok) return enc

  const { withStaleObjectVersionRetry } = await import('@/frontend/lib/direct-iota-stale-version-retry')
  return withStaleObjectVersionRetry(async () => {
    try {
      const shared = await deriveSharedSecret(opts.ecdhPrivateKey, opts.peerPubRaw)
      const epoch = stealthEpochHourUtc()
      const slotTag = deriveStealthSlotTag(shared, epoch)
      const deleteSecret = deriveStealthDeleteSecret(shared)
      const deleteCommit = deriveStealthDeleteCommit(deleteSecret, slotTag)

      const mailboxObjectId = ctx.snap.mailboxId.trim()
      const callPackageId = getStealthCallPackageId()
      /** Typ-Check am Stamm-Package; MoveCall-Target = Call-Package. */
      const mailboxCheck = await validateMessagingMailboxObjectForPackage(
        ctx.client,
        mailboxObjectId,
        ctx.snap.packageId,
        'mailbox'
      )
      if (!mailboxCheck.ok) {
        return { ok: false, error: `Diskret braucht Shared/Haupt-Mailbox: ${mailboxCheck.error}` }
      }

      const txb: Transaction = buildStoreStealthEntryTransaction({
        callPackageId,
        mailboxObjectId,
        senderAddress: ctx.snap.senderAddress.trim(),
        slotTag,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        aesTag: enc.tag,
        deleteCommit,
        ttlDays: ctx.snap.ttlDays,
      })

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
  })
}
