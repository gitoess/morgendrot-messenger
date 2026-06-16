import { vi } from 'vitest'
import {
  assembleChatViewMessengerPorts,
  type ChatViewAttachmentBarSlice,
  type ChatViewMessengerPorts,
} from '@/frontend/features/messenger-ports'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

function defaultAttachmentBarSlice(): ChatViewAttachmentBarSlice {
  return {
    sending: false,
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
    },
    composerSendPath: {
      composerDelivery: over.composerDelivery ?? 'chain',
      channelMode: over.channelMode ?? 'private',
      isGroup: over.isGroup ?? false,
      isPrivate: over.isPrivate ?? true,
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
    contactDirectory: {
      directory: over.directory ?? {},
      isMeshVerifiedForAddress: over.isMeshVerifiedForAddress ?? (() => false),
    },
    connectionStatus: {
      apiStatus: over.apiStatus ?? TEST_API_STATUS_SEND_READY,
      basisUnreachable: over.basisUnreachable,
      statusCacheAgeMinutes: null,
      packageIdMismatch: over.packageIdMismatch ?? false,
      deviceTimeTrustWarn: false,
      connectedAddresses: over.connectedAddresses ?? [],
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
