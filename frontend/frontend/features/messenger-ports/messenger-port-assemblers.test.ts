import { describe, it, expect, vi } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import { asComposerDraft } from './composer-draft-port'
import { asInboxFeedRead } from './inbox-feed-read-port'
import {
  asSendMeshMirrorDelay,
  asSendTransportChoice,
  asSendTransportRead,
} from './send-transport-ports'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { asVoiceRecordSendPanel } from './voice-record-send-panel-port'
import { assembleChatViewMessengerPorts, assembleChatViewPanelMessengerPorts } from './chat-view-core-port-assembler'
import { asHandshakeOffersRead } from './handshake-offers-read-port'
import { asInboxHandshakePanelActions } from './inbox-handshake-panel-actions-port'
import { asInboxPanelLocalActions } from './inbox-panel-local-actions-port'

describe('asInboxFeedRead', () => {
  it('behält Referenzen für messages und myAddress', () => {
    const messages: Message[] = [{ id: '1', from: '0xa', content: '', timestamp: 1 }]
    const port = asInboxFeedRead(messages, ' 0xB ')
    expect(port.messages).toBe(messages)
    expect(port.myAddress).toBe(' 0xB ')
  })
})

describe('asComposerDraft', () => {
  it('leitet Callbacks durch', () => {
    const onMsg = vi.fn()
    const onRec = vi.fn()
    const p = asComposerDraft('hi', '0xr', onMsg, onRec)
    expect(p.message).toBe('hi')
    expect(p.recipient).toBe('0xr')
    p.onMessageChange('x')
    p.onRecipientChange('y')
    expect(onMsg).toHaveBeenCalledWith('x')
    expect(onRec).toHaveBeenCalledWith('y')
  })
})

describe('asSendTransportRead', () => {
  it('mappt encrypted und forcedTransport', () => {
    const p = asSendTransportRead(true, 'mesh')
    expect(p).toEqual({ encrypted: true, forcedTransport: 'mesh' })
  })
})

describe('asSendMeshMirrorDelay', () => {
  it('mappt Pfad-4-Callbacks', () => {
    const fn4 = vi.fn()
    const p = asSendMeshMirrorDelay(false, fn4)
    p.onMeshSelfArchiveAfterLoRaChange(true)
    expect(p.meshSelfArchiveAfterLoRa).toBe(false)
    expect(fn4).toHaveBeenCalledWith(true)
  })
})

describe('asVoiceRecordSendPanel', () => {
  it('merged Hook-Slice und sosVoiceAwaitingSend', () => {
    const fromHook = {
      voicePhase: 'idle' as const,
      voiceActiveKind: null,
      voiceProgress01: 0,
      voiceMaxSeconds: 10,
      voiceEmergencyMaxSeconds: 10,
      sosVoiceFollowsOnline: true,
      onVoiceToggle: vi.fn(),
      onVoiceEmergencyToggle: vi.fn(),
      voiceNormalBlockedStart: false,
      voiceEmergencyBlockedStart: false,
      voiceBusy: false,
      voiceRecording: false,
    }
    const p = asVoiceRecordSendPanel(fromHook, true)
    expect(p.sosVoiceAwaitingSend).toBe(true)
    expect(p.voicePhase).toBe('idle')
    expect(p.onVoiceToggle).toBe(fromHook.onVoiceToggle)
  })
})

describe('asSendTransportChoice', () => {
  it('mappt Transport- und Persistenz-Felder', () => {
    const onEnc = vi.fn()
    const onTr = vi.fn()
    const onPersist = vi.fn()
    const p = asSendTransportChoice(false, onEnc, 'internet', onTr, 'event' as MessagingPersistenceMode, onPersist)
    p.onEncryptedChange(true)
    p.onForcedTransportChange('mesh')
    p.onMessagingPersistenceModeChange?.('mailbox')
    expect(onEnc).toHaveBeenCalledWith(true)
    expect(onTr).toHaveBeenCalledWith('mesh')
    expect(onPersist).toHaveBeenCalledWith('mailbox')
    expect(p.encrypted).toBe(false)
    expect(p.forcedTransport).toBe('internet')
    expect(p.messagingPersistenceMode).toBe('event')
  })
})

describe('assembleChatViewMessengerPorts', () => {
  it('bündelt Composer-, Transport- und Inbox-Ports', () => {
    const onMsg = vi.fn()
    const onRec = vi.fn()
    const onEnc = vi.fn()
    const onTr = vi.fn()
    const onPersist = vi.fn()
    const onLora = vi.fn()
    const onArchive = vi.fn()
    const ports = assembleChatViewMessengerPorts({
      composerDraft: {
        message: 'hi',
        recipient: '0xr',
        setMessage: onMsg,
        setRecipient: onRec,
      },
      composerPartner: {
        partner: '0xp',
        setPartner: vi.fn(),
      },
      composerSendPath: {
        composerDelivery: 'chain',
        setComposerDelivery: vi.fn(),
        channelMode: 'private',
        isGroup: false,
        isPrivate: true,
        composerMailboxObjectId: '',
        setComposerMailboxObjectId: vi.fn(),
      },
      transport: {
        encrypted: true,
        setEncrypted: onEnc,
        forcedTransport: 'internet',
        setForcedTransport: onTr,
        messagingPersistenceMode: 'mailbox',
        setMessagingPersistenceMode: onPersist,
      },
      meshFunk: {
        meshLoRaImagesEnabled: true,
        setMeshLoRaImagesEnabled: onLora,
        meshSelfArchiveAfterLoRa: false,
        setMeshSelfArchiveAfterLoRa: onArchive,
      },
      inboxFeed: {
        messages: [{ id: '1', from: '0xa', content: '', timestamp: 1 }],
        myAddress: '0xb',
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
        directory: {},
        isMeshVerifiedForAddress: () => false,
        refreshContactDirectory: vi.fn(),
      },
      connectionStatus: {
        apiStatus: null,
        basisUnreachable: false,
        statusCacheAgeMinutes: null,
        packageIdMismatch: false,
        deviceTimeTrustWarn: false,
        connectedAddresses: [],
        refreshApiStatus: vi.fn(async () => {}),
        statusPollAttempted: true,
      },
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
        inboxLiveSource: 'api',
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
      meshDevice: {
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
      },
      meshSetup: {
        contactBleAddress: '',
        setContactBleAddress: vi.fn(),
        contactBleUuid: '',
        setContactBleUuid: vi.fn(),
        contactBleBusy: false,
        setContactBleBusy: vi.fn(),
        meshSyncMsg: null,
        setMeshSyncMsg: vi.fn(),
        refreshContactDirectory: vi.fn(),
      },
      pinnwandFeed: {
        feedMessages: [],
        feedInboxRows: [],
      },
      shellRouting: {
        channelMode: 'private',
        isPrivate: true,
        isGroup: false,
        activeGroup: null,
        refreshMessengerGroups: vi.fn(),
        role: 'consumer',
        myAddress: '0xb',
      },
      attachmentBar: {
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
      },
    })
    expect(ports.composerDraft.message).toBe('hi')
    expect(ports.composerPartner.partner).toBe('0xp')
    expect(ports.composerSendPath.composerDelivery).toBe('chain')
    expect(ports.sendTransportRead.forcedTransport).toBe('internet')
    expect(ports.inboxFeedRead.myAddress).toBe('0xb')
    expect(ports.attachmentBar.sending).toBe(false)
    expect(ports.offlineMailboxQueueRead.pending).toBe(0)
    expect(ports.handshakeActions.onHandshake).toBeDefined()
    expect(ports.handshakeOffersRead.pendingOffers).toEqual([])
    expect(ports.inboxActions.loading).toBe(false)
    expect(ports.packageExpert.packageIdBusy).toBe(false)
    expect(ports.meshDevice.connected).toBe(false)
    expect(ports.pinnwandFeedRead.feedMessages).toEqual([])
    expect(ports.voiceRecordSendPanel).toBeNull()
  })
})

describe('assembleChatViewPanelMessengerPorts', () => {
  it('fuegt Shell-Orchestration auf Core-Ports', () => {
    const reload = vi.fn()
    const onReply = vi.fn()
    const base = assembleChatViewMessengerPorts({
      composerDraft: {
        message: '',
        recipient: '',
        setMessage: vi.fn(),
        setRecipient: vi.fn(),
      },
      composerPartner: { partner: '', setPartner: vi.fn() },
      composerSendPath: {
        composerDelivery: 'chain',
        setComposerDelivery: vi.fn(),
        channelMode: 'private',
        isGroup: false,
        isPrivate: true,
        composerMailboxObjectId: '',
        setComposerMailboxObjectId: vi.fn(),
      },
      transport: {
        encrypted: true,
        setEncrypted: vi.fn(),
        forcedTransport: 'internet',
        setForcedTransport: vi.fn(),
        messagingPersistenceMode: 'mailbox',
        setMessagingPersistenceMode: vi.fn(),
      },
      meshFunk: {
        meshLoRaImagesEnabled: false,
        setMeshLoRaImagesEnabled: vi.fn(),
        meshSelfArchiveAfterLoRa: false,
        setMeshSelfArchiveAfterLoRa: vi.fn(),
      },
      inboxFeed: { messages: [], myAddress: '0xa' },
      inboxPanelRead: {
        inboxRows: [],
        inboxTotalCount: 0,
        inboxUnreadThreadOptions: [],
        resetInboxViewFilters: vi.fn(),
      },
      inboxPreviewRead: { pinnwandStripMessages: [] },
      morgPkgArchive: {
        records: [],
        open: false,
        setOpen: vi.fn(),
        remove: vi.fn(),
        onForwardItem: vi.fn(),
      },
      contactDirectory: {
        directory: {},
        isMeshVerifiedForAddress: () => false,
        refreshContactDirectory: vi.fn(),
      },
      connectionStatus: {
        apiStatus: null,
        basisUnreachable: false,
        statusCacheAgeMinutes: null,
        packageIdMismatch: false,
        deviceTimeTrustWarn: false,
        connectedAddresses: [],
        refreshApiStatus: vi.fn(async () => {}),
        statusPollAttempted: true,
      },
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
      meshDevice: {
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
      },
      meshSetup: {
        contactBleAddress: '',
        setContactBleAddress: vi.fn(),
        contactBleUuid: '',
        setContactBleUuid: vi.fn(),
        contactBleBusy: false,
        setContactBleBusy: vi.fn(),
        meshSyncMsg: null,
        setMeshSyncMsg: vi.fn(),
        refreshContactDirectory: vi.fn(),
      },
      pinnwandFeed: { feedMessages: [], feedInboxRows: [] },
      shellRouting: {
        channelMode: 'private',
        isPrivate: true,
        isGroup: false,
        activeGroup: null,
        refreshMessengerGroups: vi.fn(),
        role: 'consumer',
        myAddress: '0xa',
      },
      attachmentBar: {
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
      },
    })
    const panel = assembleChatViewPanelMessengerPorts(base, {
      handshakeOffersRead: asHandshakeOffersRead([], [], reload),
      inboxHandshakePanelActions: asInboxHandshakePanelActions({
        pendingHandshakesLoading: false,
        pendingHandshakeCount: 0,
        onAcceptPendingHandshake: vi.fn(),
        onUseSenderAsPartnerFromInbox: vi.fn(),
        onReplyToMessage: onReply,
        onDeleteIncomingHandshake: vi.fn(),
        onDeleteOutgoingHandshake: vi.fn(),
        onResendOutgoingHandshake: vi.fn(),
      }),
      inboxPanelLocalActions: asInboxPanelLocalActions({
        onAddSenderToContactBook: vi.fn(),
        onSarqNakWire: vi.fn(),
      }),
    })
    expect(panel.inboxHandshakePanelActions.onReplyToMessage).toBe(onReply)
    expect(panel.handshakeOffersRead.reload).toBe(reload)
    expect(panel.composerDraft.message).toBe('')
  })
})
