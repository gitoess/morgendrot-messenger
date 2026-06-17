/**
 * Core-Rückgabe: nur `messengerPorts` (P9 — Orchestrator-Felder in Ports).
 */

import { assembleChatViewMessengerPorts, type ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'
import { resolveConnectedAddresses } from '@/frontend/lib/connected-peers-snapshot'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  buildPinnwandMatchContext,
  getMessengerPinnwandCapabilities,
  messageBelongsToPinnwand,
} from '@/frontend/lib/messenger-pinnwand-capabilities'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import type { Message } from '@/frontend/lib/types'
import type { ApiStatus } from '@/frontend/lib/api'
import type { ChatViewComposerTransportState } from '@/frontend/hooks/use-chat-view-composer-transport-state'
import type { ChatViewInboxOrchestration } from '@/frontend/hooks/use-chat-view-inbox-orchestration'
import type { ChatViewSendOrchestration } from '@/frontend/hooks/use-chat-view-send-orchestration'

function computePinnwandStripPreviewMessages(
  messages: readonly Message[],
  apiStatus: ApiStatus | null,
  role: string,
  channelMode: MessengerChatChannel,
  myAddress: string
): Message[] {
  const caps = getMessengerPinnwandCapabilities(apiStatus, role, channelMode, myAddress)
  if (!caps.showInboxStrip) return []
  const match = buildPinnwandMatchContext(apiStatus, myAddress)
  if (!match) return []
  return messages
    .filter((m) => messageBelongsToPinnwand(m, match))
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 3)
}

export type BuildChatViewCoreStateInput = {
  channelMode: MessengerChatChannel
  role: string
  myAddress: string
  isGroup: boolean
  activeGroup: MessengerGroupDefinition | null
  refreshMessengerGroups: () => void
  composer: ChatViewComposerTransportState
  inbox: ChatViewInboxOrchestration
  send: ChatViewSendOrchestration
}

export function buildChatViewCoreMessengerPorts(
  composer: ChatViewComposerTransportState,
  inbox: ChatViewInboxOrchestration,
  send: ChatViewSendOrchestration,
  myAddress: string,
  channelMode: MessengerChatChannel,
  isGroup: boolean,
  role: string,
  activeGroup: MessengerGroupDefinition | null,
  refreshMessengerGroups: () => void
): ChatViewMessengerPorts {
  const connectedAddresses = resolveConnectedAddresses({
    fromStatus: inbox.apiStatus?.connectedAddresses,
    preferCacheWhenEmpty: inbox.basisUnreachable,
  }).addresses

  return assembleChatViewMessengerPorts({
    composerDraft: {
      message: composer.message,
      recipient: composer.recipient,
      setMessage: composer.setMessage,
      setRecipient: composer.setRecipient,
    },
    composerPartner: {
      partner: composer.partner,
      setPartner: composer.setPartner,
    },
    composerSendPath: {
      composerDelivery: composer.composerDelivery,
      setComposerDelivery: composer.setComposerDelivery,
      channelMode,
      isGroup,
      isPrivate: composer.isPrivate,
      composerMailboxObjectId: composer.composerMailboxObjectId,
      setComposerMailboxObjectId: composer.setComposerMailboxObjectId,
    },
    transport: {
      encrypted: composer.encrypted,
      setEncrypted: composer.setEncrypted,
      forcedTransport: composer.forcedTransport,
      setForcedTransport: composer.setForcedTransport,
      messagingPersistenceMode: composer.messagingPersistenceMode,
      setMessagingPersistenceMode: composer.setMessagingPersistenceMode,
    },
    meshFunk: {
      meshLoRaImagesEnabled: composer.meshLoRaImagesEnabled,
      setMeshLoRaImagesEnabled: composer.setMeshLoRaImagesEnabled,
      meshSelfArchiveAfterLoRa: composer.meshSelfArchiveAfterLoRa,
      setMeshSelfArchiveAfterLoRa: composer.setMeshSelfArchiveAfterLoRa,
    },
    inboxFeed: {
      messages: inbox.displayMessages,
      myAddress,
    },
    inboxPanelRead: {
      inboxRows: inbox.inboxRows,
      inboxTotalCount: inbox.filteredDisplayMessages.length,
      inboxUnreadThreadOptions: inbox.inboxUnreadThreadOptions,
      resetInboxViewFilters: inbox.resetInboxViewFilters,
    },
    inboxPreviewRead: {
      pinnwandStripMessages: computePinnwandStripPreviewMessages(
        inbox.displayMessages,
        inbox.apiStatus,
        role,
        channelMode,
        myAddress
      ),
    },
    morgPkgArchive: {
      records: send.morgPkgImports,
      open: send.morgPkgImportsOpen,
      setOpen: send.setMorgPkgImportsOpen,
      remove: send.removeMorgPkgImport,
      onForwardItem: send.onForwardMorgPkgItem,
    },
    contactDirectory: {
      directory: inbox.directory,
      isMeshVerifiedForAddress: inbox.isMeshVerifiedForAddress,
      refreshContactDirectory: inbox.refreshContactDirectory,
    },
    connectionStatus: {
      apiStatus: inbox.apiStatus,
      basisUnreachable: inbox.basisUnreachable,
      statusCacheAgeMinutes: inbox.statusCacheAgeMinutes,
      packageIdMismatch: inbox.packageIdMismatch,
      deviceTimeTrustWarn: inbox.deviceTimeTrustWarn,
      statusPollAttempted: inbox.statusPollAttempted,
      connectedAddresses,
      refreshApiStatus: inbox.refreshApiStatus,
    },
    attachmentBar: {
      sending: composer.sending,
      setSending: composer.setSending,
      pickDisabled: send.voiceBusy || send.voiceRecording,
      compactFileRef: send.compactFileRef,
      compactBusy: send.compactBusy,
      attachmentPipelineHint: send.attachmentPipelineHint,
      onFileChange: send.handleCompactAttachmentPick,
      ingestChatAttachmentFile: send.ingestChatAttachmentFile,
      compactMeta: send.compactMeta,
      attachedBlobBase64: send.attachedBlobBase64,
      attachedLora: send.attachedLora,
      attachedTxtFile: send.attachedTxtFile,
      attachedAudioBase64: send.attachedAudioBase64,
      clearCompactAttachment: send.clearCompactAttachment,
      compactPreviewUrl: send.compactPreviewUrl,
      loraPreviewUrl: send.loraPreviewUrl,
      loraMeshProgressLine: composer.loraMeshProgressLine,
    },
    voiceFromHook: {
      voicePhase: send.voicePhase,
      voiceActiveKind: send.voiceActiveKind,
      voiceProgress01: send.voiceProgress01,
      voiceMaxSeconds: send.voiceMaxSeconds,
      voiceEmergencyMaxSeconds: send.voiceEmergencyMaxSeconds,
      sosVoiceFollowsOnline: send.sosVoiceFollowsOnline,
      onVoiceToggle: send.onVoiceToggle,
      onVoiceEmergencyToggle: send.onVoiceEmergencyToggle,
      voiceNormalBlockedStart: send.voiceNormalBlockedStart,
      voiceEmergencyBlockedStart: send.voiceEmergencyBlockedStart,
      voiceBusy: send.voiceBusy,
      voiceRecording: send.voiceRecording,
    },
    sosVoiceAwaitingSend: send.sosVoiceAwaitingSend,
    inboxViewUi: {
      inboxPartnerOptions: inbox.inboxPartnerOptions,
      inboxPartnerKey: inbox.inboxPartnerKey,
      setInboxPartnerKey: inbox.setInboxPartnerKey,
      inboxDirectionFilter: inbox.inboxDirectionFilter,
      setInboxDirectionFilter: inbox.setInboxDirectionFilter,
      inboxSourceFilter: inbox.inboxSourceFilter,
      setInboxSourceFilter: inbox.setInboxSourceFilter,
      inboxChannelFiltersArmed: inbox.inboxChannelFiltersArmed,
      setInboxChannelFiltersArmed: inbox.setInboxChannelFiltersArmed,
      inboxWireFiltersArmed: inbox.inboxWireFiltersArmed,
      setInboxWireFiltersArmed: inbox.setInboxWireFiltersArmed,
      inboxPartnerFiltersArmed: inbox.inboxPartnerFiltersArmed,
      setInboxPartnerFiltersArmed: inbox.setInboxPartnerFiltersArmed,
      inboxWireFilter: inbox.inboxWireFilter,
      setInboxWireFilter: inbox.setInboxWireFilter,
      selectInboxPartnerForSend: inbox.selectInboxPartnerForSend,
      selectInboxConversationAll: inbox.selectInboxConversationAll,
      selectInboxConversationPartner: inbox.selectInboxConversationPartner,
      selectInboxConversationGroup: inbox.selectInboxConversationGroup,
      inboxConversationGroupId: inbox.inboxConversationGroupId,
      removeInboxPartnerFromQuickList: inbox.removeInboxPartnerFromQuickList,
      inboxVisibilityHint: inbox.inboxVisibilityHint,
      inboxOverviewChipsVisible: inbox.inboxOverviewChipsVisible,
      inboxOverviewCategory: inbox.inboxOverviewCategory,
      setInboxOverviewCategory: inbox.setInboxOverviewCategory,
      inboxOverviewUnreadCounts: inbox.inboxOverviewUnreadCounts,
      isInboxMessageUnread: inbox.isInboxMessageUnread,
      isPinnwandInboxMessage: inbox.isPinnwandInboxMessage,
      inboxSelectMode: inbox.inboxSelectMode,
      setInboxSelectMode: inbox.setInboxSelectMode,
      selectedInboxIds: inbox.selectedInboxIds,
      hiddenInboxCount: inbox.hiddenInboxCount,
      toggleInboxSelection: inbox.toggleInboxSelection,
      selectAllVisibleInbox: inbox.selectAllVisibleInbox,
      clearInboxSelection: inbox.clearInboxSelection,
      protokollMarkedIds: inbox.protokollMarkedIds,
      toggleProtokollMark: inbox.toggleProtokollMark,
      pinnedPinnwandIds: inbox.pinnedPinnwandIds,
      togglePinnedPinnwand: inbox.togglePinnedPinnwand,
    },
    meshSendOptions: {
      meshPlaintextToNodeEnabled: send.meshPlaintextToNodeEnabled,
      setMeshPlaintextToNodeEnabled: send.setMeshPlaintextToNodeEnabled,
      meshPlaintextNodeId: send.meshPlaintextNodeId,
      setMeshPlaintextNodeId: send.setMeshPlaintextNodeId,
      meshtasticChannelIndex: composer.meshtasticChannelIndex,
      setMeshtasticChannelIndex: composer.setMeshtasticChannelIndex,
    },
    offlineMailboxQueue: {
      pending: inbox.offlineMailboxQueuePending,
      untrustedTimeCount: inbox.offlineMailboxQueueUntrustedTimeCount,
      backoffCount: inbox.offlineMailboxQueueBackoffCount,
      errorHint: inbox.offlineMailboxQueueErrorHint,
      items: inbox.offlineMailboxQueueItems,
      removeItems: inbox.removeOfflineMailboxQueueItems,
    },
    handshakeActions: {
      onHandshake: send.handleHandshake,
      onHandshakeForAddress: send.handleHandshakeForAddress,
      onConnectAcceptPartner: send.handleConnectAcceptPartner,
      onConnectAcceptForAddress: send.handleConnectAcceptForAddress,
      onConnectDeployment: send.handleConnectDeployment,
    },
    sendActions: {
      status: composer.status,
      statusMsg: composer.statusMsg,
      setStatus: composer.setStatus,
      setStatusMsg: composer.setStatusMsg,
      handleSend: send.handleSend,
      cancelSend: send.cancelSend,
      loraOnlineFallbackOffer: send.loraOnlineFallbackOffer,
      confirmLoraSendViaOnline: send.confirmLoraSendViaOnline,
      dismissLoraOnlineFallback: send.dismissLoraOnlineFallback,
    },
    inboxActions: {
      loading: inbox.loading,
      loadingMore: inbox.loadingMore,
      loadError: inbox.loadError,
      inboxFromCache: inbox.inboxFromCache,
      inboxCacheAgeMinutes: inbox.inboxCacheAgeMinutes,
      inboxLiveSource: inbox.inboxLiveSource,
      inboxHasMore: inbox.inboxHasMore,
      loadMessages: inbox.loadMessages,
      loadMoreInbox: inbox.loadMoreInbox,
      refreshContactDirectory: inbox.refreshContactDirectory,
      onHideInboxMessageLocal: inbox.onHideInboxMessageLocal,
      onPurgeInboxMessageChain: inbox.onPurgeInboxMessageChain,
      onForwardMessage: send.onForwardMessage,
      onHideAllVisibleLocal: inbox.onHideAllVisibleLocal,
      onBulkHideSelected: inbox.onBulkHideSelected,
      onBulkPurgeSelected: inbox.onBulkPurgeSelected,
      localPurgeBusy: send.localPurgeBusy,
      morgPkgFileRef: composer.morgPkgFileRef,
      morgPkgDeviceFilesRef: composer.morgPkgDeviceFilesRef,
      onMorgPkgImportFile: send.onMorgPkgImportFile,
      onMorgPkgDeviceFiles: send.onMorgPkgDeviceFiles,
      onMorgPkgDeviceExportPick: send.onMorgPkgDeviceExportPick,
      morgPkgDeviceBusy: composer.morgPkgDeviceBusy,
      morgPkgExportRecipient: send.morgPkgExportRecipient,
      setMorgPkgExportRecipient: send.setMorgPkgExportRecipient,
      morgPkgExportPartnerOptions: send.morgPkgExportPartnerOptions,
      morgPkgImportCount: send.morgPkgImports.length,
      onOpenMorgPkgArchive: () => send.setMorgPkgImportsOpen(true),
      openPartnerSetupPanel: send.openPartnerSetupPanel,
      appendMeshMessage: inbox.appendMeshMessage,
    },
    inboxExportActions: {
      exportEcdhMorgPkgForMessage: send.exportEcdhMorgPkgForMessage,
      onExportEinsatzberichtJson: inbox.onExportEinsatzberichtJson,
      onExportEinsatzberichtTxt: inbox.onExportEinsatzberichtTxt,
      onExportEinsatzberichtTxtFull: inbox.onExportEinsatzberichtTxtFull,
      onExportEinsatzberichtEncrypted: inbox.onExportEinsatzberichtEncrypted,
      onExportEinsatzprotokoll: inbox.onExportEinsatzprotokoll,
      onExportEinsatzprotokollPlainZip: inbox.onExportEinsatzprotokollPlainZip,
      onExportEinsatzprotokollMarked: inbox.onExportEinsatzprotokollMarked,
    },
    packageExpert: {
      inboxPackageFilter: inbox.inboxPackageFilter,
      setInboxPackageFilter: inbox.setInboxPackageFilter,
      packageIdSuggestions: inbox.packageIdSuggestions,
      packageIdBusy: inbox.packageIdBusy,
      refreshPackageIdSuggestions: inbox.refreshPackageIdSuggestions,
      applyPackageIdBackend: inbox.applyPackageIdBackend,
      loadMessages: inbox.loadMessages,
      syncCanonicalPackageIdFromServer: inbox.syncCanonicalPackageIdFromServer,
    },
    meshDevice: {
      bleSupported: send.meshtastic.bleSupported,
      serialSupported: send.meshtastic.serialSupported,
      transportKind: send.meshtastic.transportKind,
      setTransportKind: send.meshtastic.setTransportKind,
      connected: send.meshtastic.connected,
      connecting: send.meshtastic.connecting,
      error: send.meshtastic.error,
      lastRxDebug: send.meshtastic.lastRxDebug,
      meshRxSubscriptions: send.meshtastic.meshRxSubscriptions,
      connect: send.meshtastic.connect,
      connectBluetooth: send.meshtastic.connectBluetooth,
      connectUsb: send.meshtastic.connectUsb,
      disconnect: send.meshtastic.disconnect,
      sendMeshText: send.meshtastic.sendMeshText,
    },
    meshSetup: {
      contactBleAddress: send.contactBleAddress,
      setContactBleAddress: send.setContactBleAddress,
      contactBleUuid: send.contactBleUuid,
      setContactBleUuid: send.setContactBleUuid,
      contactBleBusy: send.contactBleBusy,
      setContactBleBusy: send.setContactBleBusy,
      meshSyncMsg: send.meshSyncMsg,
      setMeshSyncMsg: send.setMeshSyncMsg,
      refreshContactDirectory: inbox.refreshContactDirectory,
    },
    pinnwandFeed: {
      feedMessages: inbox.pinnwandFeedMessages,
      feedInboxRows: inbox.pinnwandInboxRows,
    },
    shellRouting: {
      channelMode,
      isPrivate: composer.isPrivate,
      isGroup,
      activeGroup,
      refreshMessengerGroups,
      role,
      myAddress,
    },
  })
}

export function buildChatViewCoreState(input: BuildChatViewCoreStateInput) {
  const { channelMode, role, myAddress, isGroup, activeGroup, refreshMessengerGroups, composer, inbox, send } =
    input
  const messengerPorts = buildChatViewCoreMessengerPorts(
    composer,
    inbox,
    send,
    myAddress,
    channelMode,
    isGroup,
    role,
    activeGroup,
    refreshMessengerGroups
  )

  return { messengerPorts }
}
