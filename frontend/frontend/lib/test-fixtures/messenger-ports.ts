import { vi } from 'vitest'
import {
  assembleChatViewMessengerPorts,
  assembleChatViewPanelMessengerPorts,
  asHandshakeOffersRead,
  asInboxHandshakePanelActions,
  asInboxPanelLocalActions,
  type ChatViewAttachmentBarSlice,
  type ChatViewMeshDeviceSlice,
  type ChatViewMeshSetupSlice,
  type ChatViewPinnwandFeedSlice,
  type ChatViewMessengerPorts,
  type ChatViewPanelMessengerPorts,
} from '@/frontend/features/messenger-ports'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

function defaultAttachmentBarSlice(): ChatViewAttachmentBarSlice {
  return {
    sending: false,
    setSending: vi.fn(),
    compactFileRef: { current: null },
    compactBusy: false,
    attachmentPipelineHint: null,
    onFileChange: vi.fn(),
    ingestChatAttachmentFile: vi.fn(async () => {}),
    compactMeta: null,
    attachedBlobBase64: null,
    attachedLora: null,
    attachedTxtFile: null,
    attachedAudioBase64: null,
    clearCompactAttachment: vi.fn(),
    compactPreviewUrl: null,
    loraPreviewUrl: null,
    loraMeshProgressLine: null,
  }
}

function defaultMeshDeviceSlice(over: Partial<ChatViewMeshDeviceSlice> = {}): ChatViewMeshDeviceSlice {
  return {
    bleSupported: false,
    serialSupported: false,
    transportKind: 'bluetooth',
    setTransportKind: vi.fn(),
    connected: false,
    connecting: false,
    error: null,
    lastRxDebug: null,
    meshRxSubscriptions: null,
    connect: vi.fn(async () => {}),
    connectBluetooth: vi.fn(async () => {}),
    connectUsb: vi.fn(async () => {}),
    disconnect: vi.fn(),
    sendMeshText: vi.fn(async () => 0),
    ...over,
  }
}

function defaultMeshSetupSlice(over: Partial<ChatViewMeshSetupSlice> = {}): ChatViewMeshSetupSlice {
  return {
    contactBleAddress: '',
    setContactBleAddress: vi.fn(),
    contactBleUuid: '',
    setContactBleUuid: vi.fn(),
    contactBleBusy: false,
    setContactBleBusy: vi.fn(),
    meshSyncMsg: null,
    setMeshSyncMsg: vi.fn(),
    refreshContactDirectory: vi.fn(),
    ...over,
  }
}

function defaultPinnwandFeedSlice(over: Partial<ChatViewPinnwandFeedSlice> = {}): ChatViewPinnwandFeedSlice {
  return {
    feedMessages: [],
    feedInboxRows: [],
    ...over,
  }
}

/** Minimale messengerPorts für Panel-Hook-Tests (Vitest). */
export function testMessengerPorts(over: {
  message?: string
  recipient?: string
  partner?: string
  setMessage?: (v: string) => void
  setRecipient?: (v: string) => void
  encrypted?: boolean
  forcedTransport?: 'internet' | 'mesh' | 'adhoc'
  messagingPersistenceMode?: 'event' | 'mailbox'
  myAddress?: string
  composerDelivery?: ComposerDeliveryChannel
  channelMode?: MessengerChatChannel
  isGroup?: boolean
  isPrivate?: boolean
  attachmentBar?: Partial<ChatViewAttachmentBarSlice>
  directory?: Record<string, ContactMeshEntryClient>
  apiStatus?: ApiStatus | null
  basisUnreachable?: boolean
  packageIdMismatch?: boolean
  connectedAddresses?: readonly string[]
  isMeshVerifiedForAddress?: (address: string) => boolean
  meshDevice?: Partial<ChatViewMeshDeviceSlice>
  meshSetup?: Partial<ChatViewMeshSetupSlice>
  pinnwandFeed?: Partial<ChatViewPinnwandFeedSlice>
} = {}): ChatViewMessengerPorts {
  const myAddress = over.myAddress ?? `0x${'a'.repeat(64)}`
  return assembleChatViewMessengerPorts({
    composerDraft: {
      message: over.message ?? '',
      recipient: over.recipient ?? '',
      setMessage: over.setMessage ?? vi.fn(),
      setRecipient: over.setRecipient ?? vi.fn(),
    },
    composerPartner: {
      partner: over.partner ?? '',
      setPartner: vi.fn(),
    },
    composerSendPath: {
      composerDelivery: over.composerDelivery ?? 'chain',
      setComposerDelivery: vi.fn(),
      channelMode: over.channelMode ?? 'private',
      isGroup: over.isGroup ?? false,
      isPrivate: over.isPrivate ?? true,
      composerMailboxObjectId: '',
      setComposerMailboxObjectId: vi.fn(),
    },
    transport: {
      encrypted: over.encrypted ?? true,
      setEncrypted: vi.fn(),
      forcedTransport: over.forcedTransport ?? 'internet',
      setForcedTransport: vi.fn(),
      messagingPersistenceMode: over.messagingPersistenceMode ?? 'mailbox',
      setMessagingPersistenceMode: vi.fn(),
    },
    meshFunk: {
      meshLoRaImagesEnabled: false,
      setMeshLoRaImagesEnabled: vi.fn(),
      meshSelfArchiveAfterLoRa: false,
      setMeshSelfArchiveAfterLoRa: vi.fn(),
    },
    inboxFeed: {
      messages: [],
      myAddress,
    },
    inboxPanelRead: {
      inboxRows: [],
      inboxTotalCount: 0,
      inboxUnreadThreadOptions: [],
      resetInboxViewFilters: vi.fn(),
    },
    inboxPreviewRead: {
      pinnwandStripMessages: [],
    },
    morgPkgArchive: {
      records: [],
      open: false,
      setOpen: vi.fn(),
      remove: vi.fn(),
      onForwardItem: vi.fn(),
    },
    contactDirectory: {
      directory: over.directory ?? {},
      isMeshVerifiedForAddress: over.isMeshVerifiedForAddress ?? (() => false),
      refreshContactDirectory: vi.fn(),
    },
    connectionStatus: {
      apiStatus: over.apiStatus ?? TEST_API_STATUS_SEND_READY,
      basisUnreachable: over.basisUnreachable,
      statusCacheAgeMinutes: null,
      packageIdMismatch: over.packageIdMismatch ?? false,
      deviceTimeTrustWarn: false,
      connectedAddresses: over.connectedAddresses ?? [],
      refreshApiStatus: vi.fn(async () => {}),
      statusPollAttempted: true,
    },
    attachmentBar: { ...defaultAttachmentBarSlice(), ...over.attachmentBar },
    inboxViewUi: {
      inboxPartnerOptions: [],
      inboxPartnerKey: null,
      setInboxPartnerKey: vi.fn(),
      inboxDirectionFilter: 'all',
      setInboxDirectionFilter: vi.fn(),
      inboxSourceFilter: 'all',
      setInboxSourceFilter: vi.fn(),
      inboxChannelFiltersArmed: false,
      setInboxChannelFiltersArmed: vi.fn(),
      inboxWireFiltersArmed: false,
      setInboxWireFiltersArmed: vi.fn(),
      inboxPartnerFiltersArmed: false,
      setInboxPartnerFiltersArmed: vi.fn(),
      inboxWireFilter: 'all',
      setInboxWireFilter: vi.fn(),
      selectInboxPartnerForSend: vi.fn(),
      selectInboxConversationAll: vi.fn(),
      selectInboxConversationPartner: vi.fn(),
      selectInboxConversationGroup: vi.fn(),
      inboxConversationGroupId: null,
      removeInboxPartnerFromQuickList: vi.fn(),
      inboxVisibilityHint: null,
      inboxOverviewChipsVisible: false,
      inboxOverviewCategory: 'direkt',
      setInboxOverviewCategory: vi.fn(),
      inboxOverviewUnreadCounts: { alle: 0, lagebild: 0, direkt: 0, funk: 0 },
      isInboxMessageUnread: () => false,
      isPinnwandInboxMessage: () => false,
      inboxSelectMode: false,
      setInboxSelectMode: vi.fn(),
      selectedInboxIds: new Set(),
      hiddenInboxCount: 0,
      toggleInboxSelection: vi.fn(),
      selectAllVisibleInbox: vi.fn(),
      clearInboxSelection: vi.fn(),
      protokollMarkedIds: new Set(),
      toggleProtokollMark: vi.fn(),
      pinnedPinnwandIds: new Set(),
      togglePinnedPinnwand: vi.fn(),
    },
    meshSendOptions: {
      meshPlaintextToNodeEnabled: false,
      setMeshPlaintextToNodeEnabled: vi.fn(),
      meshPlaintextNodeId: '',
      setMeshPlaintextNodeId: vi.fn(),
      meshtasticChannelIndex: undefined,
      setMeshtasticChannelIndex: vi.fn(),
    },
    offlineMailboxQueue: {
      pending: 0,
      untrustedTimeCount: 0,
      backoffCount: 0,
      errorHint: '',
      items: [],
      removeItems: vi.fn(),
    },
    handshakeActions: {
      onHandshake: vi.fn(),
      onHandshakeForAddress: vi.fn(),
      onConnectAcceptPartner: vi.fn(),
      onConnectAcceptForAddress: vi.fn(),
      onConnectDeployment: vi.fn(),
    },
    sendActions: {
      status: 'idle',
      statusMsg: '',
      setStatus: vi.fn(),
      setStatusMsg: vi.fn(),
      handleSend: vi.fn(async () => {}),
      cancelSend: vi.fn(),
      loraOnlineFallbackOffer: null,
      confirmLoraSendViaOnline: vi.fn(async () => {}),
      dismissLoraOnlineFallback: vi.fn(),
    },
    inboxActions: {
      loading: false,
      loadingMore: false,
      loadError: null,
      inboxFromCache: false,
      inboxCacheAgeMinutes: null,
      inboxLiveSource: null,
      inboxHasMore: false,
      loadMessages: vi.fn(),
      loadMoreInbox: vi.fn(),
      refreshContactDirectory: vi.fn(),
      onHideInboxMessageLocal: vi.fn(),
      onPurgeInboxMessageChain: vi.fn(async () => {}),
      onForwardMessage: vi.fn(),
      onHideAllVisibleLocal: vi.fn(),
      onBulkHideSelected: vi.fn(),
      onBulkPurgeSelected: vi.fn(),
      localPurgeBusy: false,
      morgPkgFileRef: { current: null },
      morgPkgDeviceFilesRef: { current: null },
      onMorgPkgImportFile: vi.fn(),
      onMorgPkgDeviceFiles: vi.fn(),
      onMorgPkgDeviceExportPick: vi.fn(async () => {}),
      morgPkgDeviceBusy: false,
      morgPkgExportRecipient: '',
      setMorgPkgExportRecipient: vi.fn(),
      morgPkgExportPartnerOptions: [],
      morgPkgImportCount: 0,
      onOpenMorgPkgArchive: vi.fn(),
      openPartnerSetupPanel: vi.fn(),
      appendMeshMessage: vi.fn(),
    },
    inboxExportActions: {
      exportEcdhMorgPkgForMessage: vi.fn(async () => {}),
      onExportEinsatzberichtJson: vi.fn(),
      onExportEinsatzberichtTxt: vi.fn(),
      onExportEinsatzberichtTxtFull: vi.fn(),
      onExportEinsatzberichtEncrypted: vi.fn(async () => {}),
      onExportEinsatzprotokoll: vi.fn(async () => {}),
      onExportEinsatzprotokollPlainZip: vi.fn(async () => {}),
      onExportEinsatzprotokollMarked: vi.fn(async () => {}),
    },
    packageExpert: {
      inboxPackageFilter: '',
      setInboxPackageFilter: vi.fn(),
      packageIdSuggestions: [],
      packageIdBusy: false,
      refreshPackageIdSuggestions: vi.fn(async () => {}),
      applyPackageIdBackend: vi.fn(async () => {}),
      loadMessages: vi.fn(),
      syncCanonicalPackageIdFromServer: vi.fn(async () => {}),
    },
    meshDevice: defaultMeshDeviceSlice(over.meshDevice),
    meshSetup: defaultMeshSetupSlice(over.meshSetup),
    pinnwandFeed: defaultPinnwandFeedSlice(over.pinnwandFeed),
    shellRouting: {
      channelMode: over.channelMode ?? 'private',
      isPrivate: over.isPrivate ?? true,
      isGroup: over.isGroup ?? false,
      activeGroup: null,
      refreshMessengerGroups: vi.fn(),
      role: 'consumer',
      myAddress,
    },
    voiceFromHook: {
      voicePhase: 'idle',
      voiceActiveKind: null,
      voiceProgress01: 0,
      voiceMaxSeconds: 60,
      voiceEmergencyMaxSeconds: 30,
      sosVoiceFollowsOnline: false,
      onVoiceToggle: vi.fn(),
      onVoiceEmergencyToggle: vi.fn(),
      voiceNormalBlockedStart: false,
      voiceEmergencyBlockedStart: false,
      voiceBusy: false,
      voiceRecording: false,
    },
    sosVoiceAwaitingSend: false,
  })
}

/** Core-Ports plus angereicherte Inbox-Panel-Aktionen für Hook-Tests. */
export function testPanelMessengerPorts(
  over: Parameters<typeof testMessengerPorts>[0] = {}
): ChatViewPanelMessengerPorts {
  const ports = testMessengerPorts(over)
  return assembleChatViewPanelMessengerPorts(ports, {
    handshakeOffersRead: asHandshakeOffersRead([], [], vi.fn()),
    inboxHandshakePanelActions: asInboxHandshakePanelActions({
      pendingHandshakesLoading: false,
      pendingHandshakeCount: 0,
      onAcceptPendingHandshake: vi.fn(),
      onUseSenderAsPartnerFromInbox: vi.fn(),
      onReplyToMessage: vi.fn(),
      onDeleteIncomingHandshake: vi.fn(),
      onDeleteOutgoingHandshake: vi.fn(),
      onResendOutgoingHandshake: vi.fn(),
    }),
    inboxPanelLocalActions: asInboxPanelLocalActions({
      onAddSenderToContactBook: vi.fn(),
      onSarqNakWire: vi.fn(),
    }),
  })
}
