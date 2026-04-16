'use client'

/**
 * Einheitlicher Mailbox-Versand: **Direct-IOTA** (PTB + Signatur im Browser, `@morgendrot/core`) zuerst,
 * bei Fehler oder fehlender Konfiguration **`/api`** (`/send` / `/send-plain`).
 * § H.15 — alle Pfade (Composer, SOS, Spiegel, Delayed-Mirror, …) sollen dieselbe Reihenfolge nutzen.
 */

import { sendEncryptedMessageWithTimeout, sendMessage } from '@/frontend/lib/api/chat-commands'
import {
  canTryLivePlaintextDirectMailbox,
  trySubmitPlaintextMailboxViaDirectIota,
} from '@/frontend/lib/direct-iota-plain-submit'
import {
  canTryLiveEncryptedDirectMailbox,
  trySubmitEncryptedMailboxViaDirectIotaFromPlaintext,
} from '@/frontend/lib/direct-iota-encrypted-submit'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'

export type MailboxHybridSendResult = { ok: true } | { ok: false; error?: string; message?: string }

function fromApiResponse(res: { ok?: boolean; error?: string; message?: string }): MailboxHybridSendResult {
  if (res.ok === true) return { ok: true }
  return { ok: false, error: res.error, message: res.message }
}

/** Klartext-Mailbox: Direct zuerst, dann `/send-plain`. */
export async function sendPlaintextMailboxHybrid(
  recipient: string,
  wireForApi: string,
  messageNonceU64: bigint
): Promise<MailboxHybridSendResult> {
  if (canTryLivePlaintextDirectMailbox()) {
    const dr = await trySubmitPlaintextMailboxViaDirectIota({
      recipient: recipient.trim(),
      payloadUtf8: wireForApi,
      nonce: messageNonceU64,
    })
    if (dr.ok) return { ok: true }
  }
  return fromApiResponse(await sendMessage(recipient, wireForApi, false))
}

/** Verschlüsselte Mailbox: Direct zuerst, dann `/send`. */
export async function sendEncryptedMailboxHybrid(
  recipient: string,
  wireForApi: string,
  opts?: { timeoutMs?: number }
): Promise<MailboxHybridSendResult> {
  const rTrim = recipient.trim()
  if (rTrim && canTryLiveEncryptedDirectMailbox(rTrim)) {
    const mat = getDirectChatEcdhMaterialForRecipient(rTrim)
    if (mat) {
      const er = await trySubmitEncryptedMailboxViaDirectIotaFromPlaintext({
        recipient: rTrim,
        plaintextUtf8: wireForApi,
        peerPubRaw: mat.peerPubRaw,
        ecdhPrivateKey: mat.ecdhPrivateKey,
      })
      if (er.ok) return { ok: true }
    }
  }
  return fromApiResponse(await sendEncryptedMessageWithTimeout(wireForApi, opts?.timeoutMs ?? 120_000))
}
