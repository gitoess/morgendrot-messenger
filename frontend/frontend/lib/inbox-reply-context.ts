/**
 * H.32a: Posteingang „Antworten“ — Kanal + Sendepfad aus Nachrichtenzeile ableiten.
 */
import {
  isMessageOutgoing,
  messageCounterpartyAddress,
  messagePureInternetInboxRow,
  messageTouchesInternetTransport,
  messageTouchesMeshTransport,
  messageTouchesTelegramTransport,
} from '@/frontend/features/inbox/inbox-partner-filter'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { buildForwardComposerPayload } from '@/frontend/lib/chat-forward-text'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import { isTeamBroadcastInboxMessage } from '@/frontend/lib/mailbox-purge-routing'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  readMessengerGroups,
  writeActiveGroupId,
  type MessengerGroupDefinition,
} from '@/frontend/lib/messenger-group-store'
import {
  messageBelongsToPinnwand,
  messageIsMarkedPinnwandPost,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
import { formatMeshtasticNodeIdFromNum } from '@/frontend/lib/meshtastic-node-id'
import type { Message } from '@/frontend/lib/types'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type ReplyContextVariant = {
  id: string
  label: string
  channel: MessengerChatChannel
  forcedTransport: ForcedTransport
  composerDelivery: ComposerDeliveryChannel
  recipient?: string
  partner?: string
  encrypted: boolean
  groupId?: string
  composerMailboxObjectId?: string
  meshNodeId?: string
  meshPlaintextToNodeEnabled?: boolean
  meshtasticChannelIndex?: number
  quoteText?: string
  hint?: string
}

export type ReplyContextResult =
  | { kind: 'single'; variant: ReplyContextVariant }
  | { kind: 'choice'; variants: ReplyContextVariant[] }

export type InboxReplyResolveCtx = {
  myAddress: string
  contactDirectory: Record<string, ContactMeshEntryClient>
  pinnwandBoardAddress?: string
  activeGroup?: MessengerGroupDefinition | null
}

export type ApplyReplyContextTargets = {
  onChannelModeChange?: (c: MessengerChatChannel) => void
  setForcedTransport: (t: ForcedTransport) => void
  setComposerDelivery: (d: ComposerDeliveryChannel) => void
  setPartner: (v: string) => void
  setRecipient: (v: string) => void
  setEncrypted: (v: boolean) => void
  setComposerMailboxObjectId?: (v: string) => void
  setMeshtasticChannelIndex?: (v: number | undefined) => void
  setMeshPlaintextNodeId?: (v: string) => void
  setMeshPlaintextToNodeEnabled?: (v: boolean) => void
  selectInboxPartnerForSend?: (address: string) => void
  setMessage?: (v: string) => void
  refreshMessengerGroups?: () => void
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function isValid0x(addr: string | undefined | null): addr is string {
  return !!addr && HEX64.test(addr.trim())
}

function extractMeshNodeFromFromField(from: string): string | null {
  const t = from.trim()
  const m = /^mesh:(.+)$/i.exec(t)
  if (m?.[1]?.trim()) return m[1].trim()
  if (t.startsWith('!')) return t
  return null
}

function lookupMeshNodeId(
  directory: Record<string, ContactMeshEntryClient>,
  counterparty0x: string | null
): string | null {
  if (!counterparty0x || !isValid0x(counterparty0x)) return null
  const key = norm(counterparty0x)
  const direct = directory[key]?.meshNodeId?.trim()
  if (direct) return direct
  for (const [k, entry] of Object.entries(directory)) {
    if (!isValid0x(k)) continue
    if (norm(k) === key && entry.meshNodeId?.trim()) return entry.meshNodeId.trim()
  }
  return null
}

function resolveMeshNodeId(msg: Message, directory: Record<string, ContactMeshEntryClient>, counterparty0x: string | null): string | null {
  const fromMeta = msg.meshMeta?.fromNodeNum
  if (typeof fromMeta === 'number' && fromMeta > 0) {
    return formatMeshtasticNodeIdFromNum(fromMeta)
  }
  const fromMesh = extractMeshNodeFromFromField(msg.from ?? '')
  if (fromMesh) return fromMesh
  return lookupMeshNodeId(directory, counterparty0x)
}

function resolveTelegramChatId(msg: Message, myAddress: string): string | null {
  const cp = messageCounterpartyAddress(msg, myAddress)
  if (!cp) return null
  const t = cp.trim()
  if (t.startsWith('tg:')) return t
  if (/^\d+$/.test(t)) return `tg:${t}`
  return null
}

function findGroupForTeamMailbox(teamMailboxObjectId: string): MessengerGroupDefinition | null {
  const mb = norm(teamMailboxObjectId)
  if (!mb) return null
  return readMessengerGroups().find((g) => norm(g.teamMailboxObjectId ?? '') === mb) ?? null
}

function memberInGroup(group: MessengerGroupDefinition | null | undefined, address: string | null): boolean {
  if (!group || !address || !isValid0x(address)) return false
  const a = norm(address)
  return group.memberAddresses.some((m) => norm(m) === a)
}

function buildQuoteText(msg: Message): string {
  const body = buildForwardComposerPayload(msg, false)
  const lines = body.split('\n')
  const textStart = lines.findIndex((l) => l.trim() === '')
  const excerpt = (textStart >= 0 ? lines.slice(textStart + 1) : lines).join('\n').trim()
  if (!excerpt) return ''
  const short = excerpt.length > 240 ? `${excerpt.slice(0, 240)}…` : excerpt
  return `> ${short.split('\n').join('\n> ')}\n\n`
}

function buildInternetPrivateVariant(
  msg: Message,
  myAddress: string,
  id = 'internet-1:1'
): ReplyContextVariant | null {
  const cp = messageCounterpartyAddress(msg, myAddress)
  if (!cp || !isValid0x(cp)) return null
  const encrypted = msg.encrypted === true
  return {
    id,
    label: encrypted ? 'Online 1:1 (verschlüsselt)' : 'Online 1:1',
    channel: 'private',
    forcedTransport: 'internet',
    composerDelivery: 'chain',
    recipient: cp,
    partner: cp,
    encrypted,
    quoteText: buildQuoteText(msg),
    hint: encrypted ? 'Handshake prüfen — bestehende Leiste im Composer.' : undefined,
  }
}

function buildMeshVariant(
  msg: Message,
  ctx: InboxReplyResolveCtx,
  id = 'mesh'
): ReplyContextVariant {
  const cp = messageCounterpartyAddress(msg, ctx.myAddress)
  const counterparty0x = cp && isValid0x(cp) ? cp : null
  const meshNodeId = resolveMeshNodeId(msg, ctx.contactDirectory, counterparty0x)
  const useGroup =
    isTeamBroadcastInboxMessage(msg) ||
    memberInGroup(ctx.activeGroup, counterparty0x) ||
    memberInGroup(ctx.activeGroup, msg.from)
  const group = useGroup ? ctx.activeGroup ?? findGroupForTeamMailbox(msg.recipient ?? '') : null
  const channel: MessengerChatChannel = group ? 'group' : 'private'
  const label = meshNodeId ? `Funk an ${meshNodeId}` : 'Funk'
  return {
    id,
    label,
    channel,
    forcedTransport: 'mesh',
    composerDelivery: 'chain',
    recipient: counterparty0x ?? '',
    partner: counterparty0x ?? '',
    encrypted: false,
    groupId: group?.id,
    meshNodeId: meshNodeId ?? undefined,
    meshPlaintextToNodeEnabled: meshNodeId ? true : undefined,
    meshtasticChannelIndex: group?.secondaryChannel?.channelIndex,
    quoteText: buildQuoteText(msg),
    hint: meshNodeId ? undefined : 'Funk-Node im Composer prüfen.',
  }
}

function isPinnwandReplyMessage(msg: Message, ctx: InboxReplyResolveCtx): boolean {
  if (messageIsMarkedPinnwandPost(msg)) return true
  const board = ctx.pinnwandBoardAddress?.trim()
  if (!board) return false
  return messageBelongsToPinnwand(msg, board)
}

/** Leitet Kanal, Sendepfad und Empfänger-Kontext für „Antworten“ ab. */
export function resolveReplyContextFromInboxMessage(
  msg: Message,
  ctx: InboxReplyResolveCtx
): ReplyContextResult | null {
  const me = ctx.myAddress.trim()
  if (!me) return null

  if (isPinnwandReplyMessage(msg, ctx)) {
    const board = (ctx.pinnwandBoardAddress ?? msg.recipient ?? '').trim()
    if (!isValid0x(board)) return null
    return {
      kind: 'single',
      variant: {
        id: 'pinnwand',
        label: 'Pinnwand',
        channel: 'pinnwand',
        forcedTransport: 'internet',
        composerDelivery: 'chain',
        recipient: board,
        partner: '',
        encrypted: false,
        quoteText: buildQuoteText(msg),
      },
    }
  }

  if (messageTouchesTelegramTransport(msg)) {
    const tg = resolveTelegramChatId(msg, me)
    if (!tg) return null
    return {
      kind: 'single',
      variant: {
        id: 'telegram',
        label: 'Telegram',
        channel: 'private',
        forcedTransport: 'internet',
        composerDelivery: 'telegram',
        recipient: tg,
        partner: '',
        encrypted: false,
        quoteText: buildQuoteText(msg),
      },
    }
  }

  if (isTeamBroadcastInboxMessage(msg)) {
    const teamMb = (msg.recipient ?? '').trim()
    const group = findGroupForTeamMailbox(teamMb) ?? ctx.activeGroup ?? null
    return {
      kind: 'single',
      variant: {
        id: 'team-broadcast',
        label: group?.name ? `Gruppe · ${group.name}` : 'Gruppe · Team-Broadcast',
        channel: 'group',
        forcedTransport: 'internet',
        composerDelivery: 'chain',
        recipient: '',
        partner: '',
        encrypted: false,
        groupId: group?.id,
        composerMailboxObjectId: teamMb || undefined,
        meshtasticChannelIndex: group?.secondaryChannel?.channelIndex,
        quoteText: buildQuoteText(msg),
        hint: group ? undefined : 'Aktive Gruppe im Gruppen-Tab prüfen.',
      },
    }
  }

  const meshOnly =
    messageTouchesMeshTransport(msg) &&
    !messageTouchesInternetTransport(msg)
  const meshAndInternet =
    messageTouchesMeshTransport(msg) && messageTouchesInternetTransport(msg)

  if (meshAndInternet) {
    const internet = buildInternetPrivateVariant(msg, me, 'internet-1:1')
    const mesh = buildMeshVariant(msg, ctx, 'mesh')
    const variants = [internet, mesh].filter((v): v is ReplyContextVariant => v != null)
    if (variants.length === 0) return null
    if (variants.length === 1) return { kind: 'single', variant: variants[0]! }
    return { kind: 'choice', variants }
  }

  if (meshOnly) {
    return { kind: 'single', variant: buildMeshVariant(msg, ctx) }
  }

  const internet = buildInternetPrivateVariant(msg, me)
  if (!internet) {
    if (messageTouchesMeshTransport(msg)) {
      return { kind: 'single', variant: buildMeshVariant(msg, ctx) }
    }
    return null
  }

  return { kind: 'single', variant: internet }
}

/** Wendet einen Reply-Kontext auf Composer/Tab-State an (sendet nicht). */
export function applyReplyContextVariant(
  variant: ReplyContextVariant,
  targets: ApplyReplyContextTargets
): void {
  if (variant.groupId) {
    writeActiveGroupId(variant.groupId)
    targets.refreshMessengerGroups?.()
  }

  targets.onChannelModeChange?.(variant.channel)

  if (variant.composerDelivery === 'telegram') {
    targets.setComposerDelivery('telegram')
  } else {
    targets.setForcedTransport(variant.forcedTransport)
  }

  targets.setEncrypted(variant.encrypted)

  if (variant.partner != null) targets.setPartner(variant.partner)
  if (variant.recipient != null) {
    targets.setRecipient(variant.recipient)
    if (isValid0x(variant.recipient)) {
      targets.selectInboxPartnerForSend?.(variant.recipient)
    }
  }

  if (variant.composerMailboxObjectId) {
    targets.setComposerMailboxObjectId?.(variant.composerMailboxObjectId)
  }

  if (variant.meshtasticChannelIndex != null) {
    targets.setMeshtasticChannelIndex?.(variant.meshtasticChannelIndex)
  }

  if (variant.meshNodeId) {
    targets.setMeshPlaintextNodeId?.(variant.meshNodeId)
    targets.setMeshPlaintextToNodeEnabled?.(true)
  } else if (variant.forcedTransport === 'mesh') {
    targets.setMeshPlaintextToNodeEnabled?.(false)
  }

  if (variant.quoteText != null) {
    targets.setMessage?.(variant.quoteText)
  }
}

/** True wenn für die Zeile ein Antwort-Kontext ableitbar ist. */
export function canReplyToInboxMessage(msg: Message, ctx: InboxReplyResolveCtx): boolean {
  return resolveReplyContextFromInboxMessage(msg, ctx) != null
}
