'use client'

/**
 * Einheitlicher Mailbox-Versand: **Direct-IOTA** (PTB + Signatur im Browser, `@morgendrot/core`) zuerst,
 * bei Fehler oder fehlender Konfiguration **`/api`** (`/send` / `/send-plain`).
 * § H.15 — alle Pfade (Composer, SOS, Spiegel, Delayed-Mirror, …) sollen dieselbe Reihenfolge nutzen.
 */

import type { ApiResponse } from '@/frontend/lib/types'
import {
  readMessagingPersistenceModeFromStorage,
  type MessagingPersistenceMode,
} from '@/frontend/lib/messaging-persistence-mode'
import { sendEncryptedMessageWithTimeout, sendMessage } from '@/frontend/lib/api/chat-commands'
import {
  canTryLivePlaintextDirectMailbox,
  trySubmitPlaintextMailboxViaDirectIota,
} from '@/frontend/lib/direct-iota-plain-submit'
import {
  canTryLiveTeamBroadcastDirectMailbox,
  trySubmitTeamPlaintextBroadcastViaDirectIota,
} from '@/frontend/lib/direct-iota-team-broadcast-submit'
import {
  canTryLiveEncryptedDirectMailbox,
  trySubmitEncryptedMailboxViaDirectIotaFromPlaintext,
} from '@/frontend/lib/direct-iota-encrypted-submit'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import { mergeDirectThenRelayErrors } from '@/frontend/lib/direct-iota-error-messages'
import {
  prepareEncryptedDirectMailboxSend,
  shouldSkipMessengerApiRelayFallback,
} from '@/frontend/lib/direct-iota-encrypted-send-prep'

function resolvePersistenceMode(opts?: { messagingPersistenceMode?: MessagingPersistenceMode }): MessagingPersistenceMode {
  return opts?.messagingPersistenceMode ?? readMessagingPersistenceModeFromStorage()
}

export type MailboxHybridSendResult =
  | { ok: true; txDigest?: string; nonce?: string }
  | { ok: false; error?: string; message?: string }

function txDigestFromApi(res: ApiResponse): string | undefined {
  const d = (res as { digest?: string }).digest
  if (typeof d === 'string' && d.trim()) return d.trim()
  if (typeof res.txDigest === 'string' && res.txDigest.trim()) return res.txDigest.trim()
  return undefined
}

function nonceFromApi(res: ApiResponse): string | undefined {
  const n = (res as { nonce?: string | number }).nonce
  if (typeof n === 'string' && n.trim()) return n.trim()
  if (typeof n === 'number' && Number.isFinite(n)) return String(n)
  return undefined
}

function apiRelayErrorMessage(res: ApiResponse): string {
  const parts = [res.error, res.message].map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
  return parts[0] || 'Relay/API fehlgeschlagen'
}

function fromApiResponse(res: ApiResponse): MailboxHybridSendResult {
  const digest = txDigestFromApi(res)
  if (res.ok === true || digest) {
    return { ok: true, txDigest: digest, nonce: nonceFromApi(res) }
  }
  return { ok: false, error: res.error, message: res.message }
}

/** Klartext-Mailbox: Direct zuerst, dann `/send-plain`. */
export async function sendPlaintextMailboxHybrid(
  recipient: string,
  wireForApi: string,
  messageNonceU64: bigint,
  opts?: { messagingPersistenceMode?: MessagingPersistenceMode; mailboxObjectId?: string }
): Promise<MailboxHybridSendResult> {
  let directErr: string | undefined
  if (canTryLivePlaintextDirectMailbox()) {
    const dr = await trySubmitPlaintextMailboxViaDirectIota({
      recipient: recipient.trim(),
      payloadUtf8: wireForApi,
      nonce: messageNonceU64,
      mailboxObjectId: opts?.mailboxObjectId,
    })
    if (dr.ok) return { ok: true, txDigest: dr.digest }
    directErr = dr.error
  }
  const mode = resolvePersistenceMode(opts)
  const apiRes = await sendMessage(recipient, wireForApi, false, {
    messagingPersistenceMode: mode,
    mailboxObjectId: opts?.mailboxObjectId,
  })
  const hybrid = fromApiResponse(apiRes)
  if (hybrid.ok) return hybrid
  if (directErr) {
    if (shouldSkipMessengerApiRelayFallback()) {
      return { ok: false, error: directErr }
    }
    return { ok: false, error: mergeDirectThenRelayErrors(directErr, apiRelayErrorMessage(apiRes)) }
  }
  return hybrid
}

/** Team-Broadcast Klartext: Direct zuerst, dann `/send-team-broadcast` (1× TX). */
export async function sendTeamPlaintextBroadcastHybrid(
  teamMailboxObjectId: string,
  wireForApi: string,
  messageNonceU64: bigint
): Promise<MailboxHybridSendResult> {
  const teamMb = teamMailboxObjectId.trim()
  let directErr: string | undefined
  if (canTryLiveTeamBroadcastDirectMailbox()) {
    const dr = await trySubmitTeamPlaintextBroadcastViaDirectIota({
      teamMailboxObjectId: teamMb,
      payloadUtf8: wireForApi,
      nonce: messageNonceU64,
    })
    if (dr.ok) return { ok: true, txDigest: dr.digest }
    directErr = dr.error
  }
  const { executeCommand } = await import('@/frontend/lib/api/execute-command')
  const apiRes = await executeCommand('/send-team-broadcast', [wireForApi], {
    mailboxObjectId: teamMb,
    messagingPersistenceMode: 'mailbox',
  })
  const hybrid = fromApiResponse(apiRes)
  if (hybrid.ok) return hybrid
  if (directErr) {
    if (shouldSkipMessengerApiRelayFallback()) {
      return { ok: false, error: directErr }
    }
    return { ok: false, error: mergeDirectThenRelayErrors(directErr, apiRelayErrorMessage(apiRes)) }
  }
  return hybrid
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
  const mode = resolvePersistenceMode(opts)
  const useMailboxStore = mode === 'mailbox'
  let directErr: string | undefined
  if (useMailboxStore && rTrim) {
    const prep = await prepareEncryptedDirectMailboxSend(rTrim)
    if (prep.ok) {
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
        directErr = er.error
      }
    } else {
      directErr = prep.error
    }
  }
  if (shouldSkipMessengerApiRelayFallback()) {
    return {
      ok: false,
      error:
        directErr ??
        (useMailboxStore
          ? 'Verschlüsselter Direkt-Send nicht möglich.'
          : 'Standalone ohne Basis: Persistenz „Mailbox“ in der Transport-Karte wählen (verschlüsselter Direkt-Pfad).'),
    }
  }
  const apiRes = await sendEncryptedMessageWithTimeout(wireForApi, opts?.timeoutMs ?? 120_000, {
    mailboxObjectId: opts?.mailboxObjectId,
    messagingPersistenceMode: mode,
  })
  const hybrid = fromApiResponse(apiRes)
  if (hybrid.ok) return hybrid
  if (directErr) {
    if (shouldSkipMessengerApiRelayFallback()) {
      return { ok: false, error: directErr }
    }
    return { ok: false, error: mergeDirectThenRelayErrors(directErr, apiRelayErrorMessage(apiRes)) }
  }
  return hybrid
}
