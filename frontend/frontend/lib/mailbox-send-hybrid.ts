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
import { trySubmitEncryptedMailboxViaDirectIotaFromPlaintext } from '@/frontend/lib/direct-iota-encrypted-submit'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import { mergeDirectThenRelayErrors } from '@/frontend/lib/direct-iota-error-messages'
import { syncActiveNetworkChainSnapshot, formatMainnetDirectSendBlockedMessage } from '@/frontend/lib/active-network-chain-sync'
import { tryAutoRestoreDirectIotaSessionSignerAsync } from '@/frontend/lib/direct-iota-vault-unlock-sync'
import { readNetworkProfilesState, validateNetworkProfile } from '@/frontend/lib/einsatz-network-profiles'
import { shouldSkipMessengerApiRelayFallback } from '@/frontend/lib/messenger-standalone-relay'
import { prepareEncryptedDirectSend } from '@/frontend/lib/direct-iota-encrypted-send-prep'

/** Boss `/api` nutzt oft noch Testnet-PACKAGE_ID — auf Mainnet nur Direkt-RPC, nicht Relay. */
function shouldUseMailboxApiRelayFallback(): boolean {
  if (shouldSkipMessengerApiRelayFallback()) return false
  const state = readNetworkProfilesState()
  if (state.active === 'mainnet' && validateNetworkProfile(state.mainnet).ok) return false
  return true
}

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
  if (res.ok === true) {
    return { ok: true, txDigest: txDigestFromApi(res), nonce: nonceFromApi(res) }
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
  syncActiveNetworkChainSnapshot()
  await tryAutoRestoreDirectIotaSessionSignerAsync()
  let directErr: string | undefined
  if (canTryLivePlaintextDirectMailbox()) {
    const dr = await trySubmitPlaintextMailboxViaDirectIota({
      recipient: recipient.trim(),
      payloadUtf8: wireForApi,
      nonce: messageNonceU64,
      mailboxObjectId: opts?.mailboxObjectId,
      messagingPersistenceMode: resolvePersistenceMode(opts),
    })
    if (dr.ok) return { ok: true, txDigest: dr.digest }
    directErr = dr.error
  }
  if (!shouldUseMailboxApiRelayFallback()) {
    return {
      ok: false,
      error: directErr ?? formatMainnetDirectSendBlockedMessage(),
    }
  }
  const mode = resolvePersistenceMode(opts)
  const apiRes = await sendMessage(recipient, wireForApi, false, {
    messagingPersistenceMode: mode,
    mailboxObjectId: opts?.mailboxObjectId,
  })
  const hybrid = fromApiResponse(apiRes)
  if (hybrid.ok) return hybrid
  if (directErr) {
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
  syncActiveNetworkChainSnapshot()
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
  if (!shouldUseMailboxApiRelayFallback()) {
    return { ok: false, error: directErr ?? formatMainnetDirectSendBlockedMessage() }
  }
  const { executeCommand } = await import('@/frontend/lib/api/execute-command')
  const apiRes = await executeCommand('/send-team-broadcast', [wireForApi], {
    mailboxObjectId: teamMb,
    messagingPersistenceMode: 'mailbox',
  })
  const hybrid = fromApiResponse(apiRes)
  if (hybrid.ok) return hybrid
  if (directErr) {
    return { ok: false, error: mergeDirectThenRelayErrors(directErr, apiRelayErrorMessage(apiRes)) }
  }
  return hybrid
}

/** Verschlüsselter Online-Versand: Direct zuerst (Event oder Mailbox), dann `/send`. */
export async function sendEncryptedMailboxHybrid(
  recipient: string,
  wireForApi: string,
  opts?: {
    timeoutMs?: number
    mailboxObjectId?: string
    messagingPersistenceMode?: MessagingPersistenceMode
  }
): Promise<MailboxHybridSendResult> {
  syncActiveNetworkChainSnapshot()
  await tryAutoRestoreDirectIotaSessionSignerAsync()
  const rTrim = recipient.trim()
  const mode = resolvePersistenceMode(opts)
  let directErr: string | undefined
  if (rTrim) {
    const prep = await prepareEncryptedDirectSend(rTrim, mode)
    if (!prep.ok) {
      directErr = prep.error
    } else {
      const mat = getDirectChatEcdhMaterialForRecipient(rTrim)
      if (!mat) {
        directErr = 'ECDH-Material für Empfänger fehlt nach Vorbereitung.'
      } else {
        const er = await trySubmitEncryptedMailboxViaDirectIotaFromPlaintext({
          recipient: rTrim,
          plaintextUtf8: wireForApi,
          peerPubRaw: mat.peerPubRaw,
          ecdhPrivateKey: mat.ecdhPrivateKey,
          mailboxObjectId: opts?.mailboxObjectId,
          messagingPersistenceMode: mode,
        })
        if (er.ok) return { ok: true, txDigest: er.digest }
        directErr = er.error
      }
    }
  }
  if (!shouldUseMailboxApiRelayFallback()) {
    return {
      ok: false,
      error: directErr ?? formatMainnetDirectSendBlockedMessage(),
    }
  }
  const apiRes = await sendEncryptedMessageWithTimeout(wireForApi, opts?.timeoutMs ?? 120_000, {
    mailboxObjectId: opts?.mailboxObjectId,
    messagingPersistenceMode: mode,
  })
  const hybrid = fromApiResponse(apiRes)
  if (hybrid.ok) return hybrid
  if (directErr) {
    return { ok: false, error: mergeDirectThenRelayErrors(directErr, apiRelayErrorMessage(apiRes)) }
  }
  return hybrid
}
