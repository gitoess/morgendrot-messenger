import { createRef } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewMainContent, type ChatViewMainContentProps } from '@/frontend/components/chat-view-main-content'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/frontend/hooks/use-messenger-client-expert-mode', () => ({
  useMessengerClientExpertMode: () => ({ enabled: false }),
}))

vi.mock('@/frontend/hooks/use-chat-view-pending-handshakes', () => ({
  useChatViewPendingHandshakes: () => ({
    offers: [],
    outgoingOffers: [],
    loading: false,
    reload: vi.fn(),
    dismissOffer: vi.fn(),
    dismissOutgoingOffer: vi.fn(),
  }),
}))

vi.mock('@/frontend/hooks/use-encrypted-recipient-handshake-status', () => ({
  useEncryptedRecipientHandshakeStatus: () => ({ status: 'idle', refresh: vi.fn() }),
}))

vi.mock('@/frontend/hooks/use-offline-status', () => ({
  useOfflineStatus: () => ({
    mode: 'online' as const,
    queuePending: 0,
    lastSuccessfulSyncMinutes: null,
  }),
}))

vi.mock('@/frontend/hooks/use-chat-view-telegram-composer', () => ({
  useChatViewTelegramComposer: () => ({}),
}))

vi.mock('@/frontend/components/chat-view-inbox-panel', () => ({
  ChatViewInboxPanel: () => <div data-testid="inbox-panel" />,
}))

vi.mock('@/frontend/components/chat-view-send-panel', () => ({
  ChatViewSendPanel: () => <div data-testid="send-panel" />,
}))

vi.mock('@/frontend/components/chat-view-pinnwand-feed-panel', () => ({
  ChatViewPinnwandFeedPanel: () => <div data-testid="pinnwand-feed" />,
}))

vi.mock('@/frontend/components/chat-view-phonebook-sheet', () => ({
  ChatViewPhonebookSheet: () => null,
}))

vi.mock('@/frontend/components/lazy/messenger-scope-b', () => ({
  LazyChatViewRelaySubmitButton: () => null,
  LazyChatViewMorgPkgImportsSheet: () => null,
}))

const MY_ADDR = `0x${'a'.repeat(64)}`
const PINNWAND_ADDR = `0x${'c'.repeat(64)}`
const PACKAGE_ID = `0x${'f'.repeat(64)}`

const noop = vi.fn()
const asyncNoop = vi.fn(async () => {})

function meshtasticStub() {
  return {
    bleSupported: false,
    serialSupported: false,
    transportKind: null,
    setTransportKind: noop,
    connected: false,
    connecting: false,
    error: null,
    lastRxDebug: null,
    meshRxSubscriptions: null,
    device: null,
    connect: noop,
    connectBluetooth: noop,
    connectUsb: noop,
    disconnect: noop,
    sendBinaryV2: vi.fn(async () => 0),
    sendMeshText: vi.fn(async () => 0),
  }
}

function buildMainContentProps(
  over: Partial<ChatViewMainContentProps> = {}
): ChatViewMainContentProps {
  return {
    isPrivate: true,
    isGroup: false,
    activeGroup: null,
    refreshMessengerGroups: noop,
    role: 'consumer',
    myAddress: MY_ADDR,
    message: '',
    setMessage: noop,
    recipient: '',
    setRecipient: noop,
    partner: '',
    setPartner: noop,
    sending: false,
    setSending: noop,
    status: 'idle',
    statusMsg: '',
    setStatus: noop,
    setStatusMsg: noop,
    showSetup: false,
    toggleShowSetup: noop,
    encrypted: true,
    setEncrypted: noop,
    apiStatus: TEST_API_STATUS_SEND_READY,
    refreshApiStatus: asyncNoop,
    basisUnreachable: false,
    statusCacheAgeMinutes: null,
    packageIdMismatch: false,
    deviceTimeTrustWarn: false,
    offlineMailboxQueuePending: 0,
    offlineMailboxQueueUntrustedTimeCount: 0,
    offlineMailboxQueueBackoffCount: 0,
    offlineMailboxQueueErrorHint: null,
    offlineMailboxQueueItems: [],
    removeOfflineMailboxQueueItems: noop,
    syncCanonicalPackageIdFromServer: asyncNoop,
    inboxPackageFilter: '',
    setInboxPackageFilter: noop,
    packageIdSuggestions: [],
    refreshPackageIdSuggestions: asyncNoop,
    applyPackageIdBackend: asyncNoop,
    applyInboxPackageFilterOnly: asyncNoop,
    packageIdBusy: false,
    forcedTransport: 'internet',
    setForcedTransport: noop,
    composerDelivery: 'chain',
    setComposerDelivery: noop,
    messagingPersistenceMode: 'event',
    setMessagingPersistenceMode: noop,
    composerMailboxObjectId: '',
    setComposerMailboxObjectId: noop,
    morgPkgDeviceBusy: false,
    morgPkgFileRef: createRef(),
    morgPkgDeviceFilesRef: createRef(),
    directory: {},
    refreshContactDirectory: noop,
    isMeshVerifiedForAddress: () => false,
    inboxTotalCount: 0,
    messages: [],
    setMessages: noop,
    loading: false,
    loadingMore: false,
    loadError: null,
    inboxFromCache: false,
    inboxCacheAgeMinutes: null,
    inboxLiveSource: null,
    loadMessages: asyncNoop,
    loadMoreInbox: asyncNoop,
    inboxHasMore: false,
    appendMeshMessage: noop,
    clearInboxRam: noop,
    inboxRows: [],
    pinnwandFeedMessages: [],
    pinnwandInboxRows: [],
    meshtastic: meshtasticStub(),
    meshSyncMsg: '',
    setMeshSyncMsg: noop,
    localPurgeBusy: false,
    setLocalPurgeBusy: noop,
    contactBleAddress: '',
    setContactBleAddress: noop,
    contactBleUuid: '',
    setContactBleUuid: noop,
    contactBleBusy: false,
    setContactBleBusy: noop,
    meshPlaintextToNodeEnabled: false,
    setMeshPlaintextToNodeEnabled: noop,
    meshPlaintextNodeId: '',
    setMeshPlaintextNodeId: noop,
    meshtasticChannelIndex: null,
    setMeshtasticChannelIndex: noop,
    attachedBlobBase64: null,
    attachedTxtFile: null,
    attachedAudioBase64: null,
    attachedLora: null,
    compactMeta: null,
    compactPreviewUrl: null,
    loraPreviewUrl: null,
    loraMeshProgressLine: null,
    loraOnlineFallbackOffer: null,
    compactBusy: false,
    attachmentPipelineHint: null,
    compactFileRef: createRef(),
    clearCompactAttachment: noop,
    handleCompactAttachmentPick: noop,
    ingestChatAttachmentFile: asyncNoop,
    exportEcdhMorgPkgForMessage: asyncNoop,
    onMorgPkgDeviceFiles: noop,
    onMorgPkgImportFile: noop,
    onMorgPkgDeviceExportPick: noop,
    morgPkgImports: [],
    morgPkgImportsOpen: false,
    setMorgPkgImportsOpen: noop,
    removeMorgPkgImport: noop,
    onForwardMorgPkgItem: noop,
    morgPkgExportRecipient: '',
    setMorgPkgExportRecipient: noop,
    morgPkgExportPartnerOptions: [],
    confirmLoraSendViaOnline: asyncNoop,
    handleSend: asyncNoop,
    cancelSend: noop,
    handleHandshake: asyncNoop,
    handleHandshakeForAddress: asyncNoop,
    handleConnectAcceptPartner: asyncNoop,
    handleConnectAcceptForAddress: asyncNoop,
    handleConnectDeployment: asyncNoop,
    dismissLoraOnlineFallback: noop,
    openPartnerSetupPanel: noop,
    onExportEinsatzberichtJson: asyncNoop,
    onExportEinsatzberichtTxt: asyncNoop,
    onExportEinsatzberichtTxtFull: asyncNoop,
    onExportEinsatzberichtEncrypted: asyncNoop,
    onExportEinsatzprotokoll: asyncNoop,
    onExportEinsatzprotokollPlainZip: asyncNoop,
    onExportEinsatzprotokollMarked: asyncNoop,
    meshLoRaImagesEnabled: false,
    setMeshLoRaImagesEnabled: noop,
    meshSelfArchiveAfterLoRa: false,
    setMeshSelfArchiveAfterLoRa: noop,
    protokollMarkedIds: new Set<string>(),
    pinnedPinnwandIds: new Set<string>(),
    togglePinnedPinnwand: noop,
    toggleProtokollMark: noop,
    onHideInboxMessageLocal: noop,
    onPurgeInboxMessageChain: asyncNoop,
    onForwardMessage: noop,
    onHideAllVisibleLocal: noop,
    inboxSelectMode: false,
    setInboxSelectMode: noop,
    selectedInboxIds: new Set<string>(),
    hiddenInboxCount: 0,
    toggleInboxSelection: noop,
    selectAllVisibleInbox: noop,
    clearInboxSelection: noop,
    onBulkHideSelected: noop,
    onBulkPurgeSelected: asyncNoop,
    inboxPartnerKey: '',
    setInboxPartnerKey: noop,
    inboxDirectionFilter: 'all',
    setInboxDirectionFilter: noop,
    inboxSourceFilter: 'all',
    setInboxSourceFilter: noop,
    inboxChannelFiltersArmed: false,
    setInboxChannelFiltersArmed: noop,
    inboxWireFiltersArmed: false,
    setInboxWireFiltersArmed: noop,
    inboxPartnerFiltersArmed: false,
    setInboxPartnerFiltersArmed: noop,
    inboxWireFilter: 'all',
    setInboxWireFilter: noop,
    inboxPartnerOptions: [],
    selectInboxPartnerForSend: noop,
    removeInboxPartnerFromQuickList: noop,
    resetInboxViewFilters: noop,
    inboxVisibilityHint: null,
    voicePhase: 'idle',
    voiceActiveKind: null,
    voiceProgress01: 0,
    voiceBusy: false,
    voiceRecording: false,
    onVoiceToggle: noop,
    onVoiceEmergencyToggle: noop,
    voiceNormalBlockedStart: false,
    voiceEmergencyBlockedStart: false,
    voiceMaxSeconds: 35,
    voiceEmergencyMaxSeconds: 30,
    sosVoiceFollowsOnline: false,
    sosVoiceAwaitingSend: false,
    channelMode: 'private',
    onChannelModeChange: noop,
    inboxOverviewChipsVisible: false,
    inboxOverviewCategory: 'direkt',
    setInboxOverviewCategory: noop,
    inboxOverviewUnreadCounts: { alle: 0, lagebild: 0, direkt: 0, funk: 0 },
    inboxUnreadThreadOptions: [],
    isInboxMessageUnread: () => false,
    isPinnwandInboxMessage: () => false,
    ...over,
  } as ChatViewMainContentProps
}

describe('ChatViewMainContent (§ H.1a)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('zeigt Privat-Composer und Posteingang', () => {
    render(<ChatViewMainContent {...buildMainContentProps()} />)
    expect(screen.getByRole('heading', { name: /1:1 Privat/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Nachricht verfassen/i })).toBeInTheDocument()
    expect(screen.getByTestId('inbox-panel')).toBeInTheDocument()
    expect(screen.getByTestId('send-panel')).toBeInTheDocument()
  })

  it('zeigt Gruppen-Panel im Gruppenmodus', () => {
    render(
      <ChatViewMainContent
        {...buildMainContentProps({
          isPrivate: false,
          isGroup: true,
          channelMode: 'group',
          activeGroup: {
            id: 'g1',
            name: 'Team',
            memberAddresses: [MY_ADDR],
          },
        })}
      />
    )
    expect(screen.getByRole('heading', { name: /^Gruppe$/i })).toBeInTheDocument()
    expect(screen.queryByTestId('inbox-panel')).toBeInTheDocument()
  })

  it('zeigt Pinnwand-Composer auf Pinnwand-Tab', () => {
    render(
      <ChatViewMainContent
        {...buildMainContentProps({
          isPrivate: false,
          channelMode: 'pinnwand',
          encrypted: false,
          apiStatus: {
            ...TEST_API_STATUS_SEND_READY,
            broadcastPinnwand: { enabled: true, address: PINNWAND_ADDR },
          },
        })}
      />
    )
    expect(screen.getByRole('heading', { name: /An Pinnwand senden/i })).toBeInTheDocument()
    expect(screen.getByTestId('pinnwand-feed')).toBeInTheDocument()
  })

  it('zeigt Package-ID-Banner bei Mismatch', () => {
    render(
      <ChatViewMainContent
        {...buildMainContentProps({
          packageIdMismatch: true,
          apiStatus: {
            ...TEST_API_STATUS_SEND_READY,
            iotaTransportUiEnabled: true,
            packageId: PACKAGE_ID,
          },
        })}
      />
    )
    expect(screen.getByText(/Neue Protokoll-Version verfügbar/)).toBeInTheDocument()
  })

  it('zeigt Setup-Panel nur bei Funk-Sendepfad', () => {
    const { rerender } = render(<ChatViewMainContent {...buildMainContentProps()} />)
    expect(screen.queryByRole('button', { name: /Bluetooth verbinden/i })).not.toBeInTheDocument()

    rerender(
      <ChatViewMainContent
        {...buildMainContentProps({
          forcedTransport: 'mesh',
          meshtastic: {
            ...meshtasticStub(),
            bleSupported: true,
            transportKind: 'bluetooth',
          },
        })}
      />
    )
    expect(screen.getByRole('button', { name: /Bluetooth verbinden/i })).toBeInTheDocument()
  })
})
