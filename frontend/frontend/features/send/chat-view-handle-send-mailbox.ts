'use client'

import {
  enqueueOfflineMailboxFailure,
  nextChainMessageNonceU64,
  prependMailboxOutNonceMarker,
  stableOfflineMailboxThreadId,
} from '@/frontend/lib/api'
import {
  attemptGroupInternetChainMailbox,
  GROUP_TEAM_MAILBOX_REQUIRED_MSG,
  stripMailboxOutNonceFromPayload,
  type GroupMailboxSingleResult,
} from '@/frontend/features/send/chat-view-handle-send-group'
import type {
  MailboxPartResult,
  MailboxSendCapture,
  QueueMailboxOutcome,
  SendPartOk,
} from '@/frontend/features/send/chat-view-handle-send-part-types'
import {
  isMainnetDirectSendBlockedError,
  isWrongNetworkPackageError,
  recoverMainnetDirectSendBlockedFailure,
  recoverWrongNetworkPackageSendFailure,
} from '@/frontend/lib/active-network-chain-sync'
import { formatUnknownError } from '@/frontend/lib/format-unknown-error'
import {
  sendEncryptedMailboxHybrid,
  sendPlaintextMailboxHybrid,
} from '@/frontend/lib/mailbox-send-hybrid'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import { parseComposerIotaRecipientAddresses } from '@/frontend/lib/composer-recipient-fields'
import { prependPinnwandPostMarker } from '@/frontend/lib/pinnwand-post-marker'
import { buildOfflineEncryptedQueuePayload } from '@/frontend/lib/offline-mailbox-encrypted-payload'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

const ADDR_64_LOWER = /^0x[a-f0-9]{64}$/

export function mailboxHybridErr(res: { error?: unknown; message?: unknown }): string {
  if (typeof res.error === 'string' && res.error.trim()) return res.error.trim()
  if (typeof res.message === 'string' && res.message.trim()) return res.message.trim()
  if (res.error !== undefined && res.error !== null) return formatUnknownError(res.error)
  if (res.message !== undefined && res.message !== null) return formatUnknownError(res.message)
  return 'Fehler'
}

export type ChatViewMailboxHybridOpts = {
  messagingPersistenceMode: 'event' | 'mailbox'
  mailboxObjectId?: string
}

export type ChatViewMailboxSendContext = {
  throwIfCancelled: () => void
  ensureEncryptedPeerReady: (
    target: string
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  shouldMarkPinnwandPlainPost: (target: string, enc: boolean) => boolean
  mailboxOptsFor: (to: string) => ChatViewMailboxHybridOpts
  publishGroupStreamsAfterSend: (textSnap: string, toAddr: string, multicast: boolean) => void
  onOfflineMailboxQueueChanged?: () => void
  myAddress: string
  encryptedMailboxRecipient: string
  plainMailboxRecipient: string
  composerRecipient: string
  composerPartner: string
  apiStatus?: { locked?: boolean } | null
  deviceTimeTrustWarn?: boolean
  allowOfflineMailboxQueue: boolean
  failSend: (msg: string) => SendPartOk
  groupMailboxInternetChain: boolean
  isGroupChannel: boolean
  isPrivate: boolean
  activeGroup: MessengerGroupDefinition | null
  messagingPersistenceMode: 'event' | 'mailbox'
  forcedTransport: ForcedTransport
}

function mapMailboxPartToGroupSingle(part: MailboxPartResult): GroupMailboxSingleResult {
  if (part.ok && part.mailboxCapture) {
    return { ok: true, mailboxCapture: part.mailboxCapture }
  }
  const err =
    !part.ok && 'error' in part && typeof part.error === 'string'
      ? part.error
      : 'Mailbox-Send fehlgeschlagen.'
  return { ok: false, error: err }
}

export function createChatViewMailboxSendHandlers(ctx: ChatViewMailboxSendContext) {
  const queueMailboxIfAllowed = async (
    kind: 'encrypted_send' | 'plain_send',
    wireForQueue: string,
    encrypted: boolean,
    lastErr: string,
    messageNonceU64: bigint
  ): Promise<QueueMailboxOutcome> => {
    if (!ctx.allowOfflineMailboxQueue) return 'skipped'
    if (isMainnetDirectSendBlockedError(lastErr) || isWrongNetworkPackageError(lastErr)) {
      return { reject: 'Mainnet-Direkt-Send nicht bereit — nicht in Warteschlange (§ H.12).' }
    }
    if (ctx.apiStatus?.locked || /tresor gesperrt/i.test(lastErr)) {
      return {
        reject:
          'Tresor gesperrt — bitte zuerst entsperren. Nicht erneut in die Warteschlange gelegt.',
      }
    }
    const recipientTrim = encrypted
      ? ctx.encryptedMailboxRecipient
      : ctx.plainMailboxRecipient.trim().toLowerCase()
    if (!ADDR_64_LOWER.test(recipientTrim)) {
      return { reject: 'Empfängeradresse ungültig; nicht in Mailbox-Warteschlange gespeichert.' }
    }
    let payloadForQueue = wireForQueue
    if (encrypted && kind === 'encrypted_send') {
      const encPayload = await buildOfflineEncryptedQueuePayload(recipientTrim, wireForQueue)
      if (!encPayload.ok) {
        return {
          reject: `${encPayload.error} — nicht in verschlüsselter Warteschlange gespeichert.`,
        }
      }
      payloadForQueue = encPayload.payload
    }
    const en = await enqueueOfflineMailboxFailure({
      kind,
      recipient: recipientTrim,
      payload: payloadForQueue,
      encrypted,
      timeIsTrusted: !ctx.deviceTimeTrustWarn,
      lastError: lastErr,
      senderAddress: ctx.myAddress,
      threadId: stableOfflineMailboxThreadId(ctx.myAddress, recipientTrim),
      messageNonceU64,
    })
    if (!en.ok) {
      ctx.onOfflineMailboxQueueChanged?.()
      return { reject: en.reason }
    }
    if (en.queued) {
      ctx.onOfflineMailboxQueueChanged?.()
      return 'queued'
    }
    ctx.onOfflineMailboxQueueChanged?.()
    return 'duplicate'
  }

  const sendMailboxSingle = async (
    sendTo: string,
    enc: boolean,
    textSnap: string,
    opts?: { suppressStatus?: boolean }
  ): Promise<MailboxPartResult> => {
    const failPart = (msg: string): { ok: false; error: string } => {
      if (!opts?.suppressStatus) ctx.failSend(msg)
      return { ok: false, error: msg }
    }
    ctx.throwIfCancelled()
    const target = sendTo.trim().toLowerCase()
    if (!ADDR_64_LOWER.test(target)) return failPart('Ungültige Empfänger-Wallet (0x + 64 Hex).')
    if (enc) {
      const ready = await ctx.ensureEncryptedPeerReady(target)
      if (!ready.ok) return failPart(ready.message)
    }
    let body = stripMailboxOutNonceFromPayload(textSnap)
    if (ctx.shouldMarkPinnwandPlainPost(target, enc)) {
      body = prependPinnwandPostMarker(body)
    }
    const messageNonceU64 = nextChainMessageNonceU64()
    const wireForApi = enc ? prependMailboxOutNonceMarker(body, messageNonceU64) : body
    const hybridOpts = ctx.mailboxOptsFor(target)
    const res = enc
      ? await sendEncryptedMailboxHybrid(target, wireForApi, hybridOpts)
      : await sendPlaintextMailboxHybrid(target, wireForApi, messageNonceU64, hybridOpts)
    if (res.ok) {
      ctx.publishGroupStreamsAfterSend(textSnap, target, false)
      const capture: MailboxSendCapture = {
        payloadUtf8: wireForApi,
        messageNonceU64,
        encrypted: enc,
        txDigest: res.txDigest,
      }
      return { ok: true, mailboxCapture: capture }
    }
    const errText = mailboxHybridErr(res)
    if (isWrongNetworkPackageError(errText)) {
      const { userMessage } = recoverWrongNetworkPackageSendFailure(errText, ctx.myAddress.trim())
      ctx.onOfflineMailboxQueueChanged?.()
      return failPart(userMessage)
    }
    if (isMainnetDirectSendBlockedError(errText)) {
      const { userMessage } = recoverMainnetDirectSendBlockedFailure(ctx.myAddress.trim())
      ctx.onOfflineMailboxQueueChanged?.()
      return failPart(userMessage)
    }
    const qm = await queueMailboxIfAllowed(
      enc ? 'encrypted_send' : 'plain_send',
      wireForApi,
      enc,
      errText,
      messageNonceU64
    )
    if (qm === 'queued') {
      return failPart(
        `${errText} — zwischengespeichert; erneuter Versuch, sobald die Basis wieder erreichbar ist (Opt-in „Mailbox-Warteschlange“).`
      )
    }
    if (qm === 'duplicate') {
      return failPart(
        `${errText} — dieselbe Nachricht steht bereits in der Mailbox-Warteschlange (Dedup / § H.12).`
      )
    }
    if (typeof qm === 'object' && 'reject' in qm) {
      return failPart(`Warteschlange: ${qm.reject}`)
    }
    return failPart(`${target.slice(0, 10)}…: ${errText}`)
  }

  const tryMailbox = async (textSnap: string, enc: boolean): Promise<SendPartOk> => {
    if (ctx.groupMailboxInternetChain) {
      const attempt = await attemptGroupInternetChainMailbox({
        textSnap,
        encrypted: enc,
        activeGroup: ctx.activeGroup,
        isGroupChannel: ctx.isGroupChannel,
        messagingPersistenceMode: ctx.messagingPersistenceMode,
        forcedTransport: ctx.forcedTransport,
        payloadText: stripMailboxOutNonceFromPayload(textSnap),
        myAddress: ctx.myAddress,
        composerRecipient: ctx.plainMailboxRecipient,
        sendToMember: (target) =>
          sendMailboxSingle(target, enc, textSnap, { suppressStatus: true }).then(mapMailboxPartToGroupSingle),
      })
      if (attempt.kind === 'failure') return ctx.failSend(attempt.message)
      if (attempt.kind === 'success') {
        ctx.publishGroupStreamsAfterSend(textSnap, attempt.streamsToAddr, attempt.streamsMulticast)
        if (attempt.partialFailure) return ctx.failSend(attempt.partialFailure)
        return {
          ok: true,
          groupDelivery: attempt.delivery,
          mailboxCapture: attempt.mailboxCapture,
          pairwiseTargetCount: attempt.pairwiseTargetCount,
        }
      }
      return ctx.failSend(GROUP_TEAM_MAILBOX_REQUIRED_MSG)
    }
    const targets = parseComposerIotaRecipientAddresses(ctx.composerRecipient, ctx.composerPartner, enc)
    if (targets.length > 1) {
      let lastCapture: MailboxSendCapture | undefined
      const failures: string[] = []
      for (const target of targets) {
        const part = await sendMailboxSingle(target, enc, textSnap, { suppressStatus: true })
        if (!part.ok) {
          failures.push(`${target.slice(0, 10)}…: ${'error' in part ? part.error : 'Senden fehlgeschlagen'}`)
          continue
        }
        if (part.mailboxCapture) lastCapture = part.mailboxCapture
      }
      if (!lastCapture) {
        return ctx.failSend(
          failures[0] ?? 'Broadcast an alle Empfänger fehlgeschlagen.'
        )
      }
      if (failures.length > 0) {
        return ctx.failSend(
          `${targets.length - failures.length}/${targets.length} Empfänger OK. Fehler: ${failures.slice(0, 2).join(' · ')}`
        )
      }
      return { ok: true, mailboxCapture: lastCapture, broadcastTargetCount: targets.length }
    }
    const sendTo =
      targets[0] ?? (enc && ctx.isPrivate ? ctx.encryptedMailboxRecipient : ctx.plainMailboxRecipient)
    return sendMailboxSingle(sendTo, enc, textSnap)
  }

  return { queueMailboxIfAllowed, sendMailboxSingle, tryMailbox }
}
