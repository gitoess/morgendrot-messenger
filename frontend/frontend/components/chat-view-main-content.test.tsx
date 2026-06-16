import { createRef } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewMainContent, type ChatViewMainContentProps } from '@/frontend/components/chat-view-main-content'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'
import { testMessengerPorts } from '@/frontend/lib/test-fixtures/messenger-ports'
import type { ApiStatus } from '@/frontend/lib/api'

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
  over: Partial<ChatViewMainContentProps> & {
    apiStatus?: ApiStatus | null
    packageIdMismatch?: boolean
  } = {}
): ChatViewMainContentProps {
  const {
    apiStatus: overApiStatus,
    packageIdMismatch: overPackageIdMismatch,
    messengerPorts: overPorts,
    ...restOver
  } = over
  const merged = {
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
    refreshApiStatus: asyncNoop,
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
    refreshContactDirectory: noop,
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
    loraOnlineFallbackOffer: null,
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
    onHideInboxMessageLocal: noop,
    onPurgeInboxMessageChain: asyncNoop,
    onForwardMessage: noop,
    onHideAllVisibleLocal: noop,
    onBulkHideSelected: noop,
    onBulkPurgeSelected: asyncNoop,
    resetInboxViewFilters: noop,
    channelMode: 'private',
    onChannelModeChange: noop,
    inboxUnreadThreadOptions: [],
    ...restOver,
  } as ChatViewMainContentProps
  if (overPorts == null) {
    merged.messengerPorts = testMessengerPorts({
      myAddress: merged.myAddress,
      forcedTransport: merged.forcedTransport,
      encrypted: merged.encrypted,
      composerDelivery: merged.composerDelivery,
      channelMode: merged.channelMode,
      isGroup: merged.isGroup,
      isPrivate: merged.isPrivate,
      messagingPersistenceMode: merged.messagingPersistenceMode,
      partner: merged.partner,
      apiStatus: overApiStatus ?? TEST_API_STATUS_SEND_READY,
      packageIdMismatch: overPackageIdMismatch,
    })
  } else {
    merged.messengerPorts = overPorts
  }
  return merged
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
