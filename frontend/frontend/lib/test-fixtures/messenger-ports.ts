import { vi } from 'vitest'
import {
  assembleChatViewMessengerPorts,
  type ChatViewMessengerPorts,
} from '@/frontend/features/messenger-ports'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

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
