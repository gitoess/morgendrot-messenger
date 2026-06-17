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
import { asHandshakeActions, type HandshakeActionsPort } from './handshake-actions-port'
import { asHandshakeOffersRead, type HandshakeOffersReadPort } from './handshake-offers-read-port'
import { asInboxFeedRead, type InboxFeedReadPort } from './inbox-feed-read-port'
import { asInboxPanelRead, type InboxPanelReadPort } from './inbox-panel-read-port'
import { asInboxPreviewRead, type InboxPreviewReadPort } from './inbox-preview-read-port'
import { asMorgPkgArchive, type MorgPkgArchivePort } from './morg-pkg-archive-port'
import {
  asOfflineMailboxQueueRead,
  type OfflineMailboxQueueItem,
  type OfflineMailboxQueueReadPort,
} from './offline-mailbox-queue-read-port'
import { asInboxActions, type InboxActionsPort } from './inbox-actions-port'
import type { InboxHandshakePanelActionsPort } from './inbox-handshake-panel-actions-port'
import type { InboxPanelLocalActionsPort } from './inbox-panel-local-actions-port'
import type { ChatViewShellOrchestrationPort } from './shell-orchestration-port'
import { asShellRouting, type ShellRoutingPort } from './shell-routing-port'
import { asInboxExportActions, type InboxExportActionsPort } from './inbox-export-actions-port'
import { asPackageExpert, type PackageExpertPort } from './package-expert-port'
import { asSendActions, type SendActionsPort, type SendComposerStatus } from './send-actions-port'
import { asMeshDevice, type MeshDevicePort } from './mesh-device-port'
import { asMeshSetup, type MeshSetupPort } from './mesh-setup-port'
import { asPinnwandFeedRead, type PinnwandFeedReadPort } from './pinnwand-feed-read-port'
import { asMeshSendOptions, type MeshSendOptionsPort } from './mesh-send-options-port'
import { asInboxViewUi, type InboxViewUiPort } from './inbox-view-ui-port'
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
import type { MorgPkgExportPartnerOption } from '@/frontend/lib/morg-pkg-export-partners'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import type { InboxDirectionFilter } from '@/frontend/features/inbox/inbox-partner-filter'
import type { InboxOverviewCategory } from '@/frontend/lib/inbox-overview-filter'
import type { InboxSourceFilter } from '@/frontend/lib/inbox-source-filter'
import type { InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import type { InboxUnreadThreadOption } from '@/frontend/components/chat-view-inbox-unread-threads-strip'
import type { MorgPkgImportItem, MorgPkgImportRecord } from '@/frontend/lib/morg-pkg-import-store'
import type { ChatInboxRow } from '@/frontend/features/inbox/chat-view-inbox-rows'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import type { Message } from '@/frontend/lib/types'

export type ChatViewComposerDraftSlice = {
  message: string
  recipient: string
  setMessage: (v: string) => void
  setRecipient: (v: string) => void
}

export type ChatViewComposerPartnerSlice = {
  partner: string
  setPartner: (v: string) => void
}

export type ChatViewComposerSendPathSlice = {
  composerDelivery: import('@/frontend/lib/composer-delivery-channel').ComposerDeliveryChannel
  setComposerDelivery: (d: import('@/frontend/lib/composer-delivery-channel').ComposerDeliveryChannel) => void
  channelMode?: MessengerChatChannel
  isGroup: boolean
  isPrivate: boolean
  composerMailboxObjectId: string
  setComposerMailboxObjectId: (v: string) => void
}

export type ChatViewShellRoutingSlice = {
  channelMode: MessengerChatChannel
  isPrivate: boolean
  isGroup: boolean
  activeGroup: MessengerGroupDefinition | null
  refreshMessengerGroups: () => void
  role: string
  myAddress: string
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

export type ChatViewInboxPanelReadSlice = {
  inboxRows: readonly ChatInboxRow[]
  inboxTotalCount: number
  inboxUnreadThreadOptions: readonly InboxUnreadThreadOption[]
  resetInboxViewFilters: () => void
}

export type ChatViewInboxPreviewReadSlice = {
  pinnwandStripMessages: readonly Message[]
}

export type ChatViewMorgPkgArchiveSlice = {
  records: readonly MorgPkgImportRecord[]
  open: boolean
  setOpen: (open: boolean) => void
  remove: (id: string) => void
  onForwardItem: (sender: string, item: MorgPkgImportItem) => void
}

export type ChatViewAttachmentBarSlice = {
  sending: boolean
  setSending: (v: boolean) => void
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
  refreshContactDirectory: () => void
}

export type ChatViewConnectionStatusSlice = {
  apiStatus: ApiStatus | null
  basisUnreachable: boolean | undefined
  statusCacheAgeMinutes: number | null
  packageIdMismatch: boolean
  deviceTimeTrustWarn: boolean
  connectedAddresses: readonly string[]
  refreshApiStatus: () => void | Promise<void>
  statusPollAttempted: boolean
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
  selectInboxConversationAll: () => void
  selectInboxConversationPartner: (address: string) => void
  selectInboxConversationGroup: (groupId: string) => void
  inboxConversationGroupId: string | null
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

export type ChatViewOfflineMailboxQueueSlice = {
  pending: number
  untrustedTimeCount: number
  backoffCount: number
  errorHint?: string
  items: OfflineMailboxQueueItem[]
  removeItems: (ids: string[]) => void
}

export type ChatViewHandshakeActionsSlice = {
  onHandshake: () => void | Promise<void>
  onHandshakeForAddress: (address: string) => void | Promise<void>
  onConnectAcceptPartner: () => void | Promise<void>
  onConnectAcceptForAddress: (address: string) => void | Promise<void>
  onConnectDeployment: () => void | Promise<void>
}

export type ChatViewHandshakeOffersSlice = {
  pendingOffers: import('@/frontend/lib/handshake-offers-types').PendingHandshakeOffer[]
  outgoingOffers: import('@/frontend/lib/handshake-offers-types').OutgoingHandshakeOffer[]
  reload: () => void
}

export type ChatViewSendActionsSlice = {
  status: SendComposerStatus
  statusMsg: string
  setStatus: (v: SendComposerStatus) => void
  setStatusMsg: (v: string) => void
  handleSend: (opts?: import('@/frontend/features/send/chat-send-handle-options').ChatSendHandleOptions) => void | Promise<void>
  cancelSend?: () => void
  loraOnlineFallbackOffer: { reasonLabel: string } | null
  confirmLoraSendViaOnline: () => void | Promise<void>
  dismissLoraOnlineFallback: () => void
}

export type ChatViewInboxActionsSlice = {
  loading: boolean
  loadingMore: boolean
  loadError: string | null
  inboxFromCache: boolean
  inboxCacheAgeMinutes: number | null
  inboxLiveSource: 'rpc' | 'api' | null
  inboxHasMore: boolean
  loadMessages: InboxActionsPort['loadMessages']
  loadMoreInbox: () => void
  refreshContactDirectory: () => void
  onHideInboxMessageLocal: (id: string) => void
  onPurgeInboxMessageChain: (msg: Message) => void | Promise<void>
  onForwardMessage: (msg: Message, includeSender: boolean) => void
  onHideAllVisibleLocal: () => void
  onBulkHideSelected: () => void
  onBulkPurgeSelected: () => void
  localPurgeBusy: boolean
  morgPkgFileRef: RefObject<HTMLInputElement | null>
  morgPkgDeviceFilesRef: RefObject<HTMLInputElement | null>
  onMorgPkgImportFile: (e: ChangeEvent<HTMLInputElement>) => void
  onMorgPkgDeviceFiles: (e: ChangeEvent<HTMLInputElement>) => void
  onMorgPkgDeviceExportPick: () => void | Promise<void>
  morgPkgDeviceBusy: boolean
  morgPkgExportRecipient: string
  setMorgPkgExportRecipient: (v: string) => void
  morgPkgExportPartnerOptions: MorgPkgExportPartnerOption[]
  morgPkgImportCount: number
  onOpenMorgPkgArchive: () => void
  openPartnerSetupPanel: () => void
  appendMeshMessage: InboxActionsPort['appendMeshMessage']
}

export type ChatViewInboxExportActionsSlice = {
  exportEcdhMorgPkgForMessage: (msg: Message) => void | Promise<void>
  onExportEinsatzberichtJson: () => void
  onExportEinsatzberichtTxt: () => void
  onExportEinsatzberichtTxtFull: () => void
  onExportEinsatzberichtEncrypted: () => void | Promise<void>
  onExportEinsatzprotokoll: () => void | Promise<void>
  onExportEinsatzprotokollPlainZip: () => void | Promise<void>
  onExportEinsatzprotokollMarked: () => void | Promise<void>
}

export type ChatViewPackageExpertSlice = {
  inboxPackageFilter: string
  setInboxPackageFilter: (v: string) => void
  packageIdSuggestions: string[]
  packageIdBusy: boolean
  refreshPackageIdSuggestions: (extraUnionIds?: string[]) => void | Promise<void>
  applyPackageIdBackend: (packageId: string) => void | Promise<void>
  loadMessages: InboxActionsPort['loadMessages']
  syncCanonicalPackageIdFromServer: () => void | Promise<void>
}

export type ChatViewMeshDeviceSlice = {
  bleSupported: boolean
  serialSupported: boolean
  transportKind: 'bluetooth' | 'usb'
  setTransportKind: (kind: 'bluetooth' | 'usb') => void
  connected: boolean
  connecting: boolean
  error: string | null
  lastRxDebug: string | null
  meshRxSubscriptions: string | null
  connect: () => Promise<void>
  connectBluetooth: () => Promise<void>
  connectUsb: () => Promise<void>
  disconnect: () => void
  sendMeshText: (
    text: string,
    destination?: number | 'broadcast',
    channelIndex?: number
  ) => Promise<number>
}

export type ChatViewMeshSetupSlice = {
  contactBleAddress: string
  setContactBleAddress: (v: string) => void
  contactBleUuid: string
  setContactBleUuid: (v: string) => void
  contactBleBusy: boolean
  setContactBleBusy: (v: boolean) => void
  meshSyncMsg: string | null
  setMeshSyncMsg: (v: string | null) => void
  refreshContactDirectory: () => void
}

export type ChatViewPinnwandFeedSlice = {
  feedMessages: readonly Message[]
  feedInboxRows: readonly ChatInboxRow[]
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
  inboxPanelRead: InboxPanelReadPort
  inboxPreviewRead: InboxPreviewReadPort
  morgPkgArchive: MorgPkgArchivePort
  contactDirectoryRead: ContactDirectoryReadPort
  connectionStatusRead: ConnectionStatusReadPort
  attachmentBar: AttachmentBarPort
  voiceRecordSendPanel: VoiceRecordSendPanelPort | null
  inboxViewUi: InboxViewUiPort
  meshSendOptions: MeshSendOptionsPort
  offlineMailboxQueueRead: OfflineMailboxQueueReadPort
  handshakeActions: HandshakeActionsPort
  handshakeOffersRead: HandshakeOffersReadPort
  sendActions: SendActionsPort
  inboxActions: InboxActionsPort
  inboxExportActions: InboxExportActionsPort
  packageExpert: PackageExpertPort
  meshDevice: MeshDevicePort
  meshSetup: MeshSetupPort
  pinnwandFeedRead: PinnwandFeedReadPort
  shellRouting: ShellRoutingPort
}

/** Panel-Ports = Core-Ports plus Shell-Orchestration (Handshake-Poll + Inbox-Aktionen, P7). */
export type ChatViewPanelMessengerPorts = ChatViewMessengerPorts & ChatViewShellOrchestrationPort

export function assembleShellRoutingPort(slice: ChatViewShellRoutingSlice): ShellRoutingPort {
  return asShellRouting(slice)
}

export function assembleChatViewPanelMessengerPorts(
  base: ChatViewMessengerPorts,
  shell: ChatViewShellOrchestrationPort,
  shellRoutingOverlay?: Pick<ShellRoutingPort, 'onChannelModeChange'>
): ChatViewPanelMessengerPorts {
  return {
    ...base,
    ...shell,
    shellRouting: shellRoutingOverlay
      ? { ...base.shellRouting, ...shellRoutingOverlay }
      : base.shellRouting,
  }
}

export function assembleComposerPartnerPort(slice: ChatViewComposerPartnerSlice): ComposerPartnerPort {
  return asComposerPartner(slice.partner, slice.setPartner)
}

export function assembleComposerSendPathPort(slice: ChatViewComposerSendPathSlice): ComposerSendPathPort {
  return asComposerSendPath(
    slice.composerDelivery,
    slice.setComposerDelivery,
    slice.channelMode,
    slice.isGroup,
    slice.isPrivate,
    slice.composerMailboxObjectId,
    slice.setComposerMailboxObjectId
  )
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

export function assembleInboxPanelReadPort(slice: ChatViewInboxPanelReadSlice): InboxPanelReadPort {
  return asInboxPanelRead(slice)
}

export function assembleInboxPreviewReadPort(slice: ChatViewInboxPreviewReadSlice): InboxPreviewReadPort {
  return asInboxPreviewRead(slice.pinnwandStripMessages)
}

export function assembleMorgPkgArchivePort(slice: ChatViewMorgPkgArchiveSlice): MorgPkgArchivePort {
  return asMorgPkgArchive(slice)
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
  return asContactDirectoryRead(
    slice.directory,
    slice.isMeshVerifiedForAddress,
    slice.refreshContactDirectory
  )
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
    slice.connectedAddresses,
    slice.refreshApiStatus,
    slice.statusPollAttempted
  )
}

export function assembleInboxViewUiPort(slice: ChatViewInboxViewUiSlice): InboxViewUiPort {
  return asInboxViewUi(slice)
}

export function assembleMeshSendOptionsPort(slice: ChatViewMeshSendOptionsSlice): MeshSendOptionsPort {
  return asMeshSendOptions(slice)
}

export function assembleOfflineMailboxQueueReadPort(
  slice: ChatViewOfflineMailboxQueueSlice
): OfflineMailboxQueueReadPort {
  return asOfflineMailboxQueueRead(
    slice.pending,
    slice.untrustedTimeCount,
    slice.backoffCount,
    slice.errorHint,
    slice.items,
    slice.removeItems
  )
}

export function assembleHandshakeActionsPort(slice: ChatViewHandshakeActionsSlice): HandshakeActionsPort {
  return asHandshakeActions(slice)
}

export function assembleHandshakeOffersReadPort(
  slice: ChatViewHandshakeOffersSlice
): HandshakeOffersReadPort {
  return asHandshakeOffersRead(slice.pendingOffers, slice.outgoingOffers, slice.reload)
}

export function assembleSendActionsPort(slice: ChatViewSendActionsSlice): SendActionsPort {
  return asSendActions({
    status: slice.status,
    statusMsg: slice.statusMsg,
    onStatusChange: slice.setStatus,
    onStatusMsgChange: slice.setStatusMsg,
    onStatusFeedback: (msg, st = 'success') => {
      slice.setStatus(st)
      slice.setStatusMsg(msg)
    },
    onSend: slice.handleSend,
    onCancelSend: slice.cancelSend,
    loraOnlineFallbackOffer: slice.loraOnlineFallbackOffer,
    onConfirmLoraSendViaOnline: slice.confirmLoraSendViaOnline,
    onDismissLoraOnlineFallback: slice.dismissLoraOnlineFallback,
  })
}

export function assembleInboxActionsPort(slice: ChatViewInboxActionsSlice): InboxActionsPort {
  return asInboxActions({
    loading: slice.loading,
    loadingMore: slice.loadingMore,
    loadError: slice.loadError,
    inboxFromCache: slice.inboxFromCache,
    inboxCacheAgeMinutes: slice.inboxCacheAgeMinutes,
    inboxLiveSource: slice.inboxLiveSource,
    inboxHasMore: slice.inboxHasMore,
    loadMessages: slice.loadMessages,
    loadMoreInbox: slice.loadMoreInbox,
    refreshContactDirectory: slice.refreshContactDirectory,
    onHideInboxMessageLocal: slice.onHideInboxMessageLocal,
    onPurgeInboxMessageChain: slice.onPurgeInboxMessageChain,
    onForwardMessage: slice.onForwardMessage,
    onHideAllVisibleLocal: slice.onHideAllVisibleLocal,
    onBulkHideSelected: slice.onBulkHideSelected,
    onBulkPurgeSelected: slice.onBulkPurgeSelected,
    localPurgeBusy: slice.localPurgeBusy,
    morgPkgFileRef: slice.morgPkgFileRef,
    morgPkgDeviceFilesRef: slice.morgPkgDeviceFilesRef,
    onMorgPkgImportFile: slice.onMorgPkgImportFile,
    onMorgPkgDeviceFiles: slice.onMorgPkgDeviceFiles,
    onMorgPkgDeviceExportPick: slice.onMorgPkgDeviceExportPick,
    morgPkgDeviceBusy: slice.morgPkgDeviceBusy,
    morgPkgExportRecipient: slice.morgPkgExportRecipient,
    onMorgPkgExportRecipientChange: slice.setMorgPkgExportRecipient,
    morgPkgExportPartnerOptions: slice.morgPkgExportPartnerOptions,
    morgPkgImportCount: slice.morgPkgImportCount,
    onOpenMorgPkgArchive: slice.onOpenMorgPkgArchive,
    openPartnerSetupPanel: slice.openPartnerSetupPanel,
    appendMeshMessage: slice.appendMeshMessage,
  })
}

export function assembleInboxExportActionsPort(
  slice: ChatViewInboxExportActionsSlice
): InboxExportActionsPort {
  return asInboxExportActions(slice)
}

export function assemblePackageExpertPort(slice: ChatViewPackageExpertSlice): PackageExpertPort {
  return asPackageExpert({
    inboxPackageFilter: slice.inboxPackageFilter,
    packageIdSuggestions: slice.packageIdSuggestions,
    packageIdBusy: slice.packageIdBusy,
    refreshPackageIdSuggestions: slice.refreshPackageIdSuggestions,
    applyTemporaryInboxPackage: async (packageId: string) => {
      slice.setInboxPackageFilter(packageId)
      await slice.loadMessages('reset', packageId)
    },
    clearTemporaryInboxPackage: async () => {
      slice.setInboxPackageFilter('')
      await slice.loadMessages('reset')
    },
    applyPackageIdBackend: slice.applyPackageIdBackend,
    syncCanonicalPackageIdFromServer: slice.syncCanonicalPackageIdFromServer,
  })
}

export function assembleMeshDevicePort(slice: ChatViewMeshDeviceSlice): MeshDevicePort {
  return asMeshDevice(slice)
}

export function assembleMeshSetupPort(slice: ChatViewMeshSetupSlice): MeshSetupPort {
  return asMeshSetup({
    contactBleAddress: slice.contactBleAddress,
    onContactBleAddressChange: slice.setContactBleAddress,
    contactBleUuid: slice.contactBleUuid,
    onContactBleUuidChange: slice.setContactBleUuid,
    contactBleBusy: slice.contactBleBusy,
    setContactBleBusy: slice.setContactBleBusy,
    meshSyncMsg: slice.meshSyncMsg,
    setMeshSyncMsg: slice.setMeshSyncMsg,
    refreshContactDirectory: slice.refreshContactDirectory,
  })
}

export function assemblePinnwandFeedReadPort(slice: ChatViewPinnwandFeedSlice): PinnwandFeedReadPort {
  return asPinnwandFeedRead(slice.feedMessages, slice.feedInboxRows)
}

/** Alle Standard-Ports aus den Core-Slices. */
export function assembleChatViewMessengerPorts(input: {
  composerDraft: ChatViewComposerDraftSlice
  composerPartner: ChatViewComposerPartnerSlice
  composerSendPath: ChatViewComposerSendPathSlice
  transport: ChatViewTransportSlice
  meshFunk: ChatViewMeshFunkSlice
  inboxFeed: ChatViewInboxFeedSlice
  inboxPanelRead: ChatViewInboxPanelReadSlice
  inboxPreviewRead: ChatViewInboxPreviewReadSlice
  morgPkgArchive: ChatViewMorgPkgArchiveSlice
  contactDirectory: ChatViewContactDirectorySlice
  connectionStatus: ChatViewConnectionStatusSlice
  attachmentBar: ChatViewAttachmentBarSlice
  inboxViewUi: ChatViewInboxViewUiSlice
  meshSendOptions: ChatViewMeshSendOptionsSlice
  offlineMailboxQueue: ChatViewOfflineMailboxQueueSlice
  handshakeActions: ChatViewHandshakeActionsSlice
  handshakeOffers?: ChatViewHandshakeOffersSlice
  sendActions: ChatViewSendActionsSlice
  inboxActions: ChatViewInboxActionsSlice
  inboxExportActions: ChatViewInboxExportActionsSlice
  packageExpert: ChatViewPackageExpertSlice
  meshDevice: ChatViewMeshDeviceSlice
  meshSetup: ChatViewMeshSetupSlice
  pinnwandFeed: ChatViewPinnwandFeedSlice
  shellRouting: ChatViewShellRoutingSlice
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
    inboxPanelRead: assembleInboxPanelReadPort(input.inboxPanelRead),
    inboxPreviewRead: assembleInboxPreviewReadPort(input.inboxPreviewRead),
    morgPkgArchive: assembleMorgPkgArchivePort(input.morgPkgArchive),
    contactDirectoryRead: assembleContactDirectoryReadPort(input.contactDirectory),
    connectionStatusRead: assembleConnectionStatusReadPort(input.connectionStatus),
    attachmentBar: assembleAttachmentBarPort(input.attachmentBar),
    inboxViewUi: assembleInboxViewUiPort(input.inboxViewUi),
    meshSendOptions: assembleMeshSendOptionsPort(input.meshSendOptions),
    offlineMailboxQueueRead: assembleOfflineMailboxQueueReadPort(input.offlineMailboxQueue),
    handshakeActions: assembleHandshakeActionsPort(input.handshakeActions),
    handshakeOffersRead: assembleHandshakeOffersReadPort(
      input.handshakeOffers ?? { pendingOffers: [], outgoingOffers: [], reload: () => {} }
    ),
    sendActions: assembleSendActionsPort(input.sendActions),
    inboxActions: assembleInboxActionsPort(input.inboxActions),
    inboxExportActions: assembleInboxExportActionsPort(input.inboxExportActions),
    packageExpert: assemblePackageExpertPort(input.packageExpert),
    meshDevice: assembleMeshDevicePort(input.meshDevice),
    meshSetup: assembleMeshSetupPort(input.meshSetup),
    pinnwandFeedRead: assemblePinnwandFeedReadPort(input.pinnwandFeed),
    shellRouting: assembleShellRoutingPort(input.shellRouting),
    voiceRecordSendPanel:
      input.voiceFromHook != null
        ? assembleVoiceRecordSendPanelPort(input.voiceFromHook, input.sosVoiceAwaitingSend ?? false)
        : null,
  }
}
