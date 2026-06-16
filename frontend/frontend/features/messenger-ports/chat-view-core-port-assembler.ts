/**
 * Zentrale Port-Assembler für Chat-View-Core-Slices.
 * Bündelt messenger-ports-Typen für Panel-Hooks und Tests (P1).
 */

import { asAttachmentBar, type AttachmentBarPort } from './attachment-bar-port'
import { asComposerDraft, type ComposerDraftPort, type ComposerDraftSendFlowPort } from './composer-draft-port'
import { asComposerPartner, type ComposerPartnerPort } from './composer-partner-port'
import { asComposerSendPath, type ComposerSendPathPort } from './composer-send-path-port'
import { asConnectionStatusRead, type ConnectionStatusReadPort } from './connection-status-read-port'
import { asContactDirectoryRead, type ContactDirectoryReadPort } from './contact-directory-read-port'
import { asInboxFeedRead, type InboxFeedReadPort } from './inbox-feed-read-port'
import { asInboxViewUi, type InboxViewUiPort } from './inbox-view-ui-port'
import { asMeshSendOptions, type MeshSendOptionsPort } from './mesh-send-options-port'
import {
  asSendMeshFunkOptions,
  asSendTransportChoice,
  asSendTransportRead,
  type SendMeshFunkOptionsPort,
  type SendTransportChoicePort,
  type SendTransportReadPort,
} from './send-transport-ports'
import {
  asVoiceRecordSendPanel,
  type VoiceRecordFromHook,
  type VoiceRecordSendPanelPort,
} from './voice-record-send-panel-port'
import type { ChangeEvent, RefObject } from 'react'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import type { InboxDirectionFilter } from '@/frontend/features/inbox/inbox-partner-filter'
import type { InboxOverviewCategory } from '@/frontend/lib/inbox-overview-filter'
import type { InboxSourceFilter } from '@/frontend/lib/inbox-source-filter'
import type { InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import type { Message } from '@/frontend/lib/types'

export type ChatViewComposerDraftSlice = {
  message: string
  recipient: string
  setMessage: (v: string) => void
  setRecipient: (v: string) => void
}

export type ChatViewComposerPartnerSlice = {
  partner: string
}

export type ChatViewComposerSendPathSlice = {
  composerDelivery: import('@/frontend/lib/composer-delivery-channel').ComposerDeliveryChannel
  channelMode?: import('@/frontend/lib/messenger-chat-channel').MessengerChatChannel
  isGroup: boolean
  isPrivate: boolean
}

export type ChatViewTransportSlice = {
  encrypted: boolean
  setEncrypted: (v: boolean) => void
  forcedTransport: ForcedTransport
  setForcedTransport: (t: ForcedTransport) => void
  messagingPersistenceMode: MessagingPersistenceMode
  setMessagingPersistenceMode: (m: MessagingPersistenceMode) => void
}

export type ChatViewMeshFunkSlice = {
  meshLoRaImagesEnabled: boolean
  setMeshLoRaImagesEnabled: (v: boolean) => void
  meshSelfArchiveAfterLoRa: boolean
  setMeshSelfArchiveAfterLoRa: (v: boolean) => void
}

export type ChatViewInboxFeedSlice = {
  messages: readonly Message[]
  myAddress: string
}

export type ChatViewAttachmentBarSlice = {
  sending: boolean
  pickDisabled?: boolean
  compactFileRef: RefObject<HTMLInputElement | null>
  compactBusy: boolean
  attachmentPipelineHint: string | null
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  ingestChatAttachmentFile: (
    file: File,
    opts?: { transportOverride?: ForcedTransport }
  ) => Promise<void>
  compactMeta: AttachmentBarPort['compactMeta']
  attachedBlobBase64: string | null
  attachedLora: ChatAttachedLora | null
  attachedTxtFile: { name: string; text: string } | null
  attachedAudioBase64: string | null
  clearCompactAttachment: () => void
  compactPreviewUrl: string | null
  loraPreviewUrl: string | null
  loraMeshProgressLine: string | null
}

export type ChatViewContactDirectorySlice = {
  directory: Record<string, ContactMeshEntryClient>
  isMeshVerifiedForAddress: (address: string) => boolean
}

export type ChatViewConnectionStatusSlice = {
  apiStatus: ApiStatus | null
  basisUnreachable: boolean | undefined
  statusCacheAgeMinutes: number | null
  packageIdMismatch: boolean
  deviceTimeTrustWarn: boolean
  connectedAddresses: readonly string[]
}

export type ChatViewInboxViewUiSlice = {
  inboxPartnerOptions: InboxPartnerOption[]
  inboxPartnerKey: string | null
  setInboxPartnerKey: (k: string | null) => void
  inboxDirectionFilter: InboxDirectionFilter
  setInboxDirectionFilter: (d: InboxDirectionFilter) => void
  inboxSourceFilter: InboxSourceFilter
  setInboxSourceFilter: (f: InboxSourceFilter) => void
  inboxChannelFiltersArmed: boolean
  setInboxChannelFiltersArmed: (v: boolean) => void
  inboxWireFiltersArmed: boolean
  setInboxWireFiltersArmed: (v: boolean) => void
  inboxPartnerFiltersArmed: boolean
  setInboxPartnerFiltersArmed: (v: boolean) => void
  inboxWireFilter: InboxWireFilter
  setInboxWireFilter: (f: InboxWireFilter) => void
  selectInboxPartnerForSend: (address: string) => void
  removeInboxPartnerFromQuickList: InboxViewUiPort['removeInboxPartnerFromQuickList']
  inboxVisibilityHint: string | null | undefined
  inboxOverviewChipsVisible: boolean
  inboxOverviewCategory: InboxOverviewCategory
  setInboxOverviewCategory: (c: InboxOverviewCategory) => void
  inboxOverviewUnreadCounts: Record<InboxOverviewCategory, number>
  isInboxMessageUnread: (msg: Message) => boolean
  isPinnwandInboxMessage: (msg: Message) => boolean
  inboxSelectMode: boolean
  setInboxSelectMode: (v: boolean | ((p: boolean) => boolean)) => void
  selectedInboxIds: Set<string>
  hiddenInboxCount: number
  toggleInboxSelection: (id: string) => void
  selectAllVisibleInbox: () => void
  clearInboxSelection: () => void
  protokollMarkedIds: Set<string>
  toggleProtokollMark: (id: string) => void
  pinnedPinnwandIds: Set<string>
  togglePinnedPinnwand: (id: string) => void
}

export type ChatViewMeshSendOptionsSlice = {
  meshPlaintextToNodeEnabled: boolean
  setMeshPlaintextToNodeEnabled: (v: boolean) => void
  meshPlaintextNodeId: string
  setMeshPlaintextNodeId: (v: string) => void
  meshtasticChannelIndex: number | undefined
  setMeshtasticChannelIndex: (v: number | undefined) => void
}

export type ChatViewMessengerPorts = {
  composerDraft: ComposerDraftPort
  composerDraftSendFlow: ComposerDraftSendFlowPort
  composerPartner: ComposerPartnerPort
  composerSendPath: ComposerSendPathPort
  sendTransportChoice: SendTransportChoicePort
  sendTransportRead: SendTransportReadPort
  sendMeshFunkOptions: SendMeshFunkOptionsPort
  inboxFeedRead: InboxFeedReadPort
  contactDirectoryRead: ContactDirectoryReadPort
  connectionStatusRead: ConnectionStatusReadPort
  attachmentBar: AttachmentBarPort
  voiceRecordSendPanel: VoiceRecordSendPanelPort | null
  inboxViewUi: InboxViewUiPort
  meshSendOptions: MeshSendOptionsPort
}

export function assembleComposerPartnerPort(slice: ChatViewComposerPartnerSlice): ComposerPartnerPort {
  return asComposerPartner(slice.partner)
}

export function assembleComposerSendPathPort(slice: ChatViewComposerSendPathSlice): ComposerSendPathPort {
  return asComposerSendPath(slice.composerDelivery, slice.channelMode, slice.isGroup, slice.isPrivate)
}

export function assembleComposerDraftPort(slice: ChatViewComposerDraftSlice): ComposerDraftPort {
  return asComposerDraft(slice.message, slice.recipient, slice.setMessage, slice.setRecipient)
}

export function assembleComposerDraftSendFlowPort(slice: ChatViewComposerDraftSlice): ComposerDraftSendFlowPort {
  return {
    message: slice.message,
    recipient: slice.recipient,
    setMessage: slice.setMessage,
  }
}

export function assembleSendTransportChoicePort(slice: ChatViewTransportSlice): SendTransportChoicePort {
  return asSendTransportChoice(
    slice.encrypted,
    slice.setEncrypted,
    slice.forcedTransport,
    slice.setForcedTransport,
    slice.messagingPersistenceMode,
    slice.setMessagingPersistenceMode
  )
}

export function assembleSendTransportReadPort(slice: Pick<ChatViewTransportSlice, 'encrypted' | 'forcedTransport'>): SendTransportReadPort {
  return asSendTransportRead(slice.encrypted, slice.forcedTransport)
}

export function assembleSendMeshFunkOptionsPort(slice: ChatViewMeshFunkSlice): SendMeshFunkOptionsPort {
  return asSendMeshFunkOptions(
    slice.meshLoRaImagesEnabled,
    slice.setMeshLoRaImagesEnabled,
    slice.meshSelfArchiveAfterLoRa,
    slice.setMeshSelfArchiveAfterLoRa
  )
}

export function assembleInboxFeedReadPort(slice: ChatViewInboxFeedSlice): InboxFeedReadPort {
  return asInboxFeedRead(slice.messages, slice.myAddress)
}

export function assembleVoiceRecordSendPanelPort(
  fromHook: VoiceRecordFromHook,
  sosVoiceAwaitingSend: boolean
): VoiceRecordSendPanelPort {
  return asVoiceRecordSendPanel(fromHook, sosVoiceAwaitingSend)
}

export function assembleAttachmentBarPort(slice: ChatViewAttachmentBarSlice): AttachmentBarPort {
  return asAttachmentBar(slice)
}

export function assembleContactDirectoryReadPort(
  slice: ChatViewContactDirectorySlice
): ContactDirectoryReadPort {
  return asContactDirectoryRead(slice.directory, slice.isMeshVerifiedForAddress)
}

export function assembleConnectionStatusReadPort(
  slice: ChatViewConnectionStatusSlice
): ConnectionStatusReadPort {
  return asConnectionStatusRead(
    slice.apiStatus,
    slice.basisUnreachable,
    slice.statusCacheAgeMinutes,
    slice.packageIdMismatch,
    slice.deviceTimeTrustWarn,
    slice.connectedAddresses
  )
}

export function assembleInboxViewUiPort(slice: ChatViewInboxViewUiSlice): InboxViewUiPort {
  return asInboxViewUi(slice)
}

export function assembleMeshSendOptionsPort(slice: ChatViewMeshSendOptionsSlice): MeshSendOptionsPort {
  return asMeshSendOptions(slice)
}

/** Alle Standard-Ports aus den Core-Slices. */
export function assembleChatViewMessengerPorts(input: {
  composerDraft: ChatViewComposerDraftSlice
  composerPartner: ChatViewComposerPartnerSlice
  composerSendPath: ChatViewComposerSendPathSlice
  transport: ChatViewTransportSlice
  meshFunk: ChatViewMeshFunkSlice
  inboxFeed: ChatViewInboxFeedSlice
  contactDirectory: ChatViewContactDirectorySlice
  connectionStatus: ChatViewConnectionStatusSlice
  attachmentBar: ChatViewAttachmentBarSlice
  inboxViewUi: ChatViewInboxViewUiSlice
  meshSendOptions: ChatViewMeshSendOptionsSlice
  voiceFromHook?: VoiceRecordFromHook
  sosVoiceAwaitingSend?: boolean
}): ChatViewMessengerPorts {
  return {
    composerDraft: assembleComposerDraftPort(input.composerDraft),
    composerDraftSendFlow: assembleComposerDraftSendFlowPort(input.composerDraft),
    composerPartner: assembleComposerPartnerPort(input.composerPartner),
    composerSendPath: assembleComposerSendPathPort(input.composerSendPath),
    sendTransportChoice: assembleSendTransportChoicePort(input.transport),
    sendTransportRead: assembleSendTransportReadPort(input.transport),
    sendMeshFunkOptions: assembleSendMeshFunkOptionsPort(input.meshFunk),
    inboxFeedRead: assembleInboxFeedReadPort(input.inboxFeed),
    contactDirectoryRead: assembleContactDirectoryReadPort(input.contactDirectory),
    connectionStatusRead: assembleConnectionStatusReadPort(input.connectionStatus),
    attachmentBar: assembleAttachmentBarPort(input.attachmentBar),
    inboxViewUi: assembleInboxViewUiPort(input.inboxViewUi),
    meshSendOptions: assembleMeshSendOptionsPort(input.meshSendOptions),
    voiceRecordSendPanel:
      input.voiceFromHook != null
        ? assembleVoiceRecordSendPanelPort(input.voiceFromHook, input.sosVoiceAwaitingSend ?? false)
        : null,
  }
}
