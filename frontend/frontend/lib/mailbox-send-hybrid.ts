'use client'

/**
 * Einheitlicher Mailbox-Versand: **Direct-IOTA** (PTB + Signatur im Browser, `@morgendrot/core`) zuerst,
 * bei Fehler oder fehlender Konfiguration **`/api`** (`/send` / `/send-plain`).
 * § H.15 — alle Pfade (Composer, SOS, Spiegel, Delayed-Mirror, …) sollen dieselbe Reihenfolge nutzen.
 */

import type { ApiResponse } from '@/frontend/lib/types'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
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

export type MailboxHybridSendResult =
  | { ok: true; txDigest?: string }
  | { ok: false; error?: string; message?: string }

function txDigestFromApi(res: ApiResponse): string | undefined {
  const d = (res as { digest?: string }).digest
  if (typeof d === 'string' && d.trim()) return d.trim()
  if (typeof res.txDigest === 'string' && res.txDigest.trim()) return res.txDigest.trim()
  return undefined
}

function fromApiResponse(res: ApiResponse): MailboxHybridSendResult {
  if (res.ok === true) return { ok: true, txDigest: txDigestFromApi(res) }
  return { ok: false, error: res.error, message: res.message }
}

/** Klartext-Mailbox: Direct zuerst, dann `/send-plain`. */
export async function sendPlaintextMailboxHybrid(
  recipient: string,
  wireForApi: string,
  messageNonceU64: bigint,
  opts?: { messagingPersistenceMode?: MessagingPersistenceMode; mailboxObjectId?: string }
): Promise<MailboxHybridSendResult> {
  if (canTryLivePlaintextDirectMailbox()) {
    const dr = await trySubmitPlaintextMailboxViaDirectIota({
      recipient: recipient.trim(),
      payloadUtf8: wireForApi,
      nonce: messageNonceU64,
      mailboxObjectId: opts?.mailboxObjectId,
    })
    if (dr.ok) return { ok: true, txDigest: dr.digest }
  }
  return fromApiResponse(
    await sendMessage(recipient, wireForApi, false, {
      messagingPersistenceMode: opts?.messagingPersistenceMode,
      mailboxObjectId: opts?.mailboxObjectId,
    })
  )
}

/** Verschlüsselter Online-Versand: bei Modus „mailbox“ Direct zuerst, dann `/send` (inkl. Event-Modus). */
export async function sendEncryptedMailboxHybrid(
  recipient: string,
  wireForApi: string,
  opts?: {
    timeoutMs?: number
    mailboxObjectId?: string
    messagingPersistenceMode?: MessagingPersistenceMode
  }
): Promise<MailboxHybridSendResult> {
  const rTrim = recipient.trim()
  const useMailboxStore = opts?.messagingPersistenceMode === 'mailbox'
  if (useMailboxStore && rTrim && canTryLiveEncryptedDirectMailbox(rTrim)) {
    const mat = getDirectChatEcdhMaterialForRecipient(rTrim)
    if (mat) {
      const er = await trySubmitEncryptedMailboxViaDirectIotaFromPlaintext({
        recipient: rTrim,
        plaintextUtf8: wireForApi,
        peerPubRaw: mat.peerPubRaw,
        ecdhPrivateKey: mat.ecdhPrivateKey,
        mailboxObjectId: opts?.mailboxObjectId,
      })
      if (er.ok) return { ok: true, txDigest: er.digest }
    }
  }
  return fromApiResponse(
    await sendEncryptedMessageWithTimeout(wireForApi, opts?.timeoutMs ?? 120_000, {
      mailboxObjectId: opts?.mailboxObjectId,
      messagingPersistenceMode: opts?.messagingPersistenceMode,
    })
  )
}
