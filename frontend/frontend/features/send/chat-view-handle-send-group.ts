'use client'

import { nextChainMessageNonceU64, parseMailboxOutNonceMarker } from '@/frontend/lib/api'
import { publishStreamsAnchor } from '@/frontend/lib/api/streams'
import {
  buildGroupMailboxOptimisticInboxRows,
  mergeOptimisticGroupInboxRows,
} from '@/frontend/lib/group-inbox-optimistic'
import {
  readGroupMailboxSendAll,
  resolveGroupMailboxSendTargets,
} from '@/frontend/lib/group-mailbox-pairwise-send'
import {
  GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG,
  GROUP_TEAM_MAILBOX_REQUIRED_MSG,
  groupUsesTeamBroadcast,
  isGroupMailboxInternetChainSend,
  resolveGroupTeamMailboxObjectId,
  shouldSendGroupTeamBroadcast,
} from '@/frontend/lib/group-team-broadcast'
import { sendTeamPlaintextBroadcastHybrid, sendTeamEncryptedBroadcastHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import { encryptTeamBroadcastPlaintext } from '@/frontend/lib/team-broadcast-encrypted-send'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import type { Message } from '@/frontend/lib/types'

export {
  GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG,
  GROUP_TEAM_MAILBOX_REQUIRED_MSG,
  isGroupMailboxInternetChainSend,
  readGroupMailboxSendAll,
  resolveGroupTeamMailboxObjectId,
  resolveGroupMailboxSendTargets,
}

export type GroupSendDelivery = 'team-broadcast' | 'pairwise'

export type GroupMailboxSingleResult =
  | { ok: true; mailboxCapture: GroupMailboxCapture }
  | { ok: false; error: string }

export const GROUP_NO_MEMBERS_MSG =
  'Gruppe: mindestens ein anderes Mitglied (0x…) in der Gruppenliste speichern.'

export type GroupMailboxCapture = {
  payloadUtf8: string
  messageNonceU64: bigint
  encrypted: boolean
  txDigest?: string
}

export type GroupTeamBroadcastAttempt =
  | { kind: 'not-applicable' }
  | { kind: 'success'; mailboxCapture: GroupMailboxCapture; teamMailboxObjectId: string }
  | { kind: 'failure'; message: string }

export type GroupSendTransportContext = {
  isGroupChannel: boolean
  messagingPersistenceMode: 'event' | 'mailbox'
  forcedTransport: 'internet' | 'mesh' | 'adhoc'
}

export function stripMailboxOutNonceFromPayload(snap: string): string {
  return parseMailboxOutNonceMarker(snap)?.rest ?? snap
}

export function resolveGroupTargetsForInternetSend(p: {
  activeGroup: MessengerGroupDefinition | null
  myAddress: string
  composerRecipient: string
}): string[] {
  return resolveGroupMailboxSendTargets({
    activeGroup: p.activeGroup,
    myAddress: p.myAddress,
    composerRecipient: p.composerRecipient,
    sendAllMembers: readGroupMailboxSendAll(),
  })
}

/** Blockiert Send vor Composer — verschlüsselt ohne Team-E2EE oder fehlendes Team-Postfach / Mitglieder. */
export function getGroupSendPreSendError(p: {
  activeGroup: MessengerGroupDefinition | null
  encrypted: boolean
  myAddress?: string
  composerRecipient?: string
} & GroupSendTransportContext): string | null {
  if (
    !isGroupMailboxInternetChainSend({
      isGroupChannel: p.isGroupChannel,
      messagingPersistenceMode: p.messagingPersistenceMode,
      forcedTransport: p.forcedTransport,
    })
  ) {
    return null
  }
  const teamMb = resolveGroupTeamMailboxObjectId(p.activeGroup)
  if (teamMb && groupUsesTeamBroadcast(p.activeGroup)) return null
  const targets = resolveGroupTargetsForInternetSend({
    activeGroup: p.activeGroup,
    myAddress: p.myAddress ?? '',
    composerRecipient: p.composerRecipient ?? '',
  })
  if (targets.length > 0) return null
  if (groupUsesTeamBroadcast(p.activeGroup)) return GROUP_TEAM_MAILBOX_REQUIRED_MSG
  return GROUP_NO_MEMBERS_MSG
}

export function groupTeamBroadcastWireSuccessMessage(): string {
  return 'Team-Broadcast gesendet (1× Chain). Posteingang: Kanal „Alle“ oder „Ausgang“.'
}

export function groupPairwiseWireSuccessMessage(targetCount: number): string {
  return `An ${targetCount} Gruppenmitglieder gesendet (pairwise Mailbox, ${targetCount}× Chain).`
}

export function resolveSingleWireSuccessMessage(
  isGroupChannel: boolean,
  delivery?: GroupSendDelivery,
  pairwiseTargetCount?: number
): string | null {
  if (isGroupChannel && delivery === 'team-broadcast') {
    return groupTeamBroadcastWireSuccessMessage()
  }
  if (isGroupChannel && delivery === 'pairwise' && pairwiseTargetCount != null && pairwiseTargetCount > 0) {
    return groupPairwiseWireSuccessMessage(pairwiseTargetCount)
  }
  return null
}

export const GROUP_INBOX_RELOAD_DELAYS_MS = [1200, 4000, 9000] as const
export const PRIVATE_INBOX_RELOAD_DELAY_MS = 1200

export function inboxReloadDelaysMs(isGroupChannel: boolean): readonly number[] {
  return isGroupChannel ? GROUP_INBOX_RELOAD_DELAYS_MS : [PRIVATE_INBOX_RELOAD_DELAY_MS]
}

export function publishGroupStreamsAnchorAfterSend(p: {
  isGroupChannel: boolean
  activeGroup: MessengerGroupDefinition | null
  myAddress: string
  textSnap: string
  toAddr: string
  multicast: boolean
}): void {
  if (!p.isGroupChannel || !p.activeGroup?.streamsAnchorId) return
  void publishStreamsAnchor(p.activeGroup.streamsAnchorId, {
    type: 'group_message',
    groupId: p.activeGroup.id,
    from: p.myAddress.trim(),
    to: p.multicast ? `@group:${p.activeGroup.id}` : p.toAddr,
    preview: p.multicast ? `${p.textSnap.slice(0, 180)} [team-broadcast]` : p.textSnap.slice(0, 240),
    ts: Date.now(),
  })
}

export async function attemptGroupTeamBroadcast(
  p: {
    textSnap: string
    encrypted: boolean
    activeGroup: MessengerGroupDefinition | null
    payloadText?: string
  } & GroupSendTransportContext
): Promise<GroupTeamBroadcastAttempt> {
  if (
    !shouldSendGroupTeamBroadcast({
      activeGroup: p.activeGroup,
      encrypted: p.encrypted,
      messagingPersistenceMode: p.messagingPersistenceMode,
      forcedTransport: p.forcedTransport,
      sendAllMembers: readGroupMailboxSendAll(),
      isGroupChannel: p.isGroupChannel,
    })
  ) {
    return { kind: 'not-applicable' }
  }
  const teamMb = resolveGroupTeamMailboxObjectId(p.activeGroup)
  if (!teamMb) return { kind: 'not-applicable' }

  const body = p.payloadText ?? stripMailboxOutNonceFromPayload(p.textSnap)
  const messageNonceU64 = nextChainMessageNonceU64()

  if (p.encrypted) {
    if (!p.activeGroup?.id) {
      return { kind: 'failure', message: GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG }
    }
    const enc = await encryptTeamBroadcastPlaintext({
      teamMailboxObjectId: teamMb,
      groupId: p.activeGroup.id,
      plaintextUtf8: body,
    })
    const res = await sendTeamEncryptedBroadcastHybrid(teamMb, enc, messageNonceU64)
    if (res.ok) {
      return {
        kind: 'success',
        teamMailboxObjectId: teamMb,
        mailboxCapture: {
          payloadUtf8: body,
          messageNonceU64,
          encrypted: true,
          txDigest: res.txDigest,
        },
      }
    }
    const errText = res.error || res.message || 'Verschlüsselter Team-Broadcast fehlgeschlagen.'
    return {
      kind: 'failure',
      message: `${errText} — Move braucht store_team_encrypted_broadcast (nach Deploy).`,
    }
  }

  const res = await sendTeamPlaintextBroadcastHybrid(teamMb, body, messageNonceU64)
  if (res.ok) {
    return {
      kind: 'success',
      teamMailboxObjectId: teamMb,
      mailboxCapture: {
        payloadUtf8: body,
        messageNonceU64,
        encrypted: false,
        txDigest: res.txDigest,
      },
    }
  }
  const errText = res.error || res.message || 'Team-Broadcast fehlgeschlagen.'
  return {
    kind: 'failure',
    message: `${errText} — Team-Postfach muss zum aktuellen Move-Package passen (nach Deploy neu anlegen).`,
  }
}

export type GroupPairwiseAttempt =
  | { kind: 'not-applicable' }
  | {
      kind: 'success'
      mailboxCapture: GroupMailboxCapture
      targetCount: number
      partialFailure?: string
    }
  | { kind: 'failure'; message: string }

export async function attemptGroupPairwiseMailboxSend(p: {
  targets: string[]
  sendToMember: (target: string) => Promise<GroupMailboxSingleResult>
}): Promise<GroupPairwiseAttempt> {
  if (p.targets.length === 0) return { kind: 'not-applicable' }
  let okCount = 0
  const failures: string[] = []
  let lastCapture: GroupMailboxCapture | undefined
  for (const sendTo of p.targets) {
    const part = await p.sendToMember(sendTo)
    if (part.ok) {
      okCount++
      lastCapture = part.mailboxCapture
    } else {
      failures.push(part.error)
    }
  }
  if (okCount === 0) {
    return {
      kind: 'failure',
      message:
        failures[0] ??
        'An kein Gruppenmitglied gesendet — Handshake/Connect pro 0x prüfen (verschlüsselt) oder Klartext wählen.',
    }
  }
  const partialFailure =
    failures.length > 0
      ? `Gruppe: ${okCount}/${p.targets.length} Mitglieder OK (pairwise Mailbox). Erster Fehler: ${failures[0]}`
      : undefined
  return {
    kind: 'success',
    mailboxCapture: lastCapture!,
    targetCount: p.targets.length,
    partialFailure,
  }
}

export type GroupInternetChainMailboxAttempt =
  | { kind: 'not-applicable' }
  | { kind: 'failure'; message: string }
  | {
      kind: 'success'
      delivery: GroupSendDelivery
      mailboxCapture: GroupMailboxCapture
      streamsToAddr: string
      streamsMulticast: boolean
      pairwiseTargetCount?: number
      partialFailure?: string
    }

export async function attemptGroupInternetChainMailbox(
  p: {
    textSnap: string
    encrypted: boolean
    activeGroup: MessengerGroupDefinition | null
    payloadText?: string
    myAddress: string
    composerRecipient: string
    sendToMember: (target: string) => Promise<GroupMailboxSingleResult>
  } & GroupSendTransportContext
): Promise<GroupInternetChainMailboxAttempt> {
  if (
    !isGroupMailboxInternetChainSend({
      isGroupChannel: p.isGroupChannel,
      messagingPersistenceMode: p.messagingPersistenceMode,
      forcedTransport: p.forcedTransport,
    })
  ) {
    return { kind: 'not-applicable' }
  }

  const tb = await attemptGroupTeamBroadcast({
    textSnap: p.textSnap,
    encrypted: p.encrypted,
    activeGroup: p.activeGroup,
    isGroupChannel: p.isGroupChannel,
    messagingPersistenceMode: p.messagingPersistenceMode,
    forcedTransport: p.forcedTransport,
    payloadText: p.payloadText,
  })
  if (tb.kind === 'success') {
    return {
      kind: 'success',
      delivery: 'team-broadcast',
      mailboxCapture: tb.mailboxCapture,
      streamsToAddr: tb.teamMailboxObjectId,
      streamsMulticast: true,
    }
  }
  if (tb.kind === 'failure') return { kind: 'failure', message: tb.message }

  const targets = resolveGroupTargetsForInternetSend({
    activeGroup: p.activeGroup,
    myAddress: p.myAddress,
    composerRecipient: p.composerRecipient,
  })
  const pw = await attemptGroupPairwiseMailboxSend({
    targets,
    sendToMember: p.sendToMember,
  })
  if (pw.kind === 'failure') return { kind: 'failure', message: pw.message }
  if (pw.kind === 'not-applicable') {
    return { kind: 'failure', message: GROUP_TEAM_MAILBOX_REQUIRED_MSG }
  }
  return {
    kind: 'success',
    delivery: 'pairwise',
    mailboxCapture: pw.mailboxCapture,
    streamsToAddr: targets[0] ?? '',
    streamsMulticast: true,
    pairwiseTargetCount: pw.targetCount,
    partialFailure: pw.partialFailure,
  }
}

export function buildGroupTeamBroadcastOptimisticRows(p: {
  myAddress: string
  activeGroup: MessengerGroupDefinition | null
  mailboxCapture: GroupMailboxCapture
  previewFallback: string
} & GroupSendTransportContext): Message[] {
  if (
    !p.isGroupChannel ||
    p.forcedTransport !== 'internet' ||
    p.messagingPersistenceMode !== 'mailbox'
  ) {
    return []
  }
  const previewText = p.mailboxCapture.payloadUtf8?.trim() || p.previewFallback.trim()
  if (!previewText) return []
  return buildGroupMailboxOptimisticInboxRows({
    myAddress: p.myAddress,
    text: previewText,
    encrypted: p.mailboxCapture.encrypted,
    messageNonceU64: p.mailboxCapture.messageNonceU64,
    mode: 'team-broadcast',
    teamMailboxObjectId: resolveGroupTeamMailboxObjectId(p.activeGroup),
  })
}

export function buildGroupPairwiseOptimisticRows(p: {
  myAddress: string
  mailboxCapture: GroupMailboxCapture
  previewFallback: string
  pairwiseTargets: string[]
} & GroupSendTransportContext): Message[] {
  if (
    !p.isGroupChannel ||
    p.forcedTransport !== 'internet' ||
    p.messagingPersistenceMode !== 'mailbox'
  ) {
    return []
  }
  const previewText = p.mailboxCapture.payloadUtf8?.trim() || p.previewFallback.trim()
  if (!previewText) return []
  return buildGroupMailboxOptimisticInboxRows({
    myAddress: p.myAddress,
    text: previewText,
    encrypted: p.mailboxCapture.encrypted,
    messageNonceU64: p.mailboxCapture.messageNonceU64,
    mode: 'pairwise',
    pairwiseTargets: p.pairwiseTargets,
  })
}

export function buildGroupOptimisticRowsAfterSend(
  p: {
    delivery: GroupSendDelivery
    myAddress: string
    activeGroup: MessengerGroupDefinition | null
    mailboxCapture: GroupMailboxCapture
    previewFallback: string
    pairwiseTargets?: string[]
  } & GroupSendTransportContext
): Message[] {
  if (p.delivery === 'team-broadcast') {
    return buildGroupTeamBroadcastOptimisticRows({
      isGroupChannel: p.isGroupChannel,
      forcedTransport: p.forcedTransport,
      messagingPersistenceMode: p.messagingPersistenceMode,
      myAddress: p.myAddress,
      activeGroup: p.activeGroup,
      mailboxCapture: p.mailboxCapture,
      previewFallback: p.previewFallback,
    })
  }
  return buildGroupPairwiseOptimisticRows({
    isGroupChannel: p.isGroupChannel,
    forcedTransport: p.forcedTransport,
    messagingPersistenceMode: p.messagingPersistenceMode,
    myAddress: p.myAddress,
    mailboxCapture: p.mailboxCapture,
    previewFallback: p.previewFallback,
    pairwiseTargets: p.pairwiseTargets ?? [],
  })
}

export function applyGroupOptimisticInboxMerge(prev: Message[], rows: Message[]): Message[] {
  if (rows.length === 0) return prev
  return mergeOptimisticGroupInboxRows(prev, rows)
}
