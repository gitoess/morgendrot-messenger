'use client'

import { nextChainMessageNonceU64, parseMailboxOutNonceMarker } from '@/frontend/lib/api'
import { publishStreamsAnchor } from '@/frontend/lib/api/streams'
import {
  buildGroupMailboxOptimisticInboxRows,
  mergeOptimisticGroupInboxRows,
} from '@/frontend/lib/group-inbox-optimistic'
import { readGroupMailboxSendAll } from '@/frontend/lib/group-mailbox-pairwise-send'
import {
  GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG,
  GROUP_TEAM_MAILBOX_REQUIRED_MSG,
  isGroupMailboxInternetChainSend,
  resolveGroupTeamMailboxObjectId,
  shouldSendGroupTeamBroadcast,
} from '@/frontend/lib/group-team-broadcast'
import { sendTeamPlaintextBroadcastHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import type { Message } from '@/frontend/lib/types'

export {
  GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG,
  GROUP_TEAM_MAILBOX_REQUIRED_MSG,
  isGroupMailboxInternetChainSend,
  resolveGroupTeamMailboxObjectId,
}

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

/** Blockiert Send vor Composer — verschlüsselt ohne Team-E2EE oder fehlendes Team-Postfach. */
export function getGroupSendPreSendError(p: {
  activeGroup: MessengerGroupDefinition | null
  encrypted: boolean
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
  if (p.encrypted) return GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG
  if (!resolveGroupTeamMailboxObjectId(p.activeGroup)) return GROUP_TEAM_MAILBOX_REQUIRED_MSG
  return null
}

export function groupTeamBroadcastWireSuccessMessage(): string {
  return 'Team-Broadcast gesendet (1× Chain). Posteingang: Kanal „Alle“ oder „Ausgang“.'
}

export function resolveSingleWireSuccessMessage(
  isGroupChannel: boolean,
  delivery?: 'team-broadcast' | 'pairwise'
): string | null {
  if (isGroupChannel && delivery === 'team-broadcast') {
    return groupTeamBroadcastWireSuccessMessage()
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

export function applyGroupOptimisticInboxMerge(prev: Message[], rows: Message[]): Message[] {
  if (rows.length === 0) return prev
  return mergeOptimisticGroupInboxRows(prev, rows)
}
