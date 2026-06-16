import { vi } from 'vitest'
import {
  assembleChatViewMessengerPorts,
  type ChatViewMessengerPorts,
} from '@/frontend/features/messenger-ports'

/** Minimale messengerPorts für Panel-Hook-Tests (Vitest). */
export function testMessengerPorts(over: {
  message?: string
  recipient?: string
  encrypted?: boolean
  forcedTransport?: 'internet' | 'mesh' | 'adhoc'
  messagingPersistenceMode?: 'event' | 'mailbox'
  myAddress?: string
} = {}): ChatViewMessengerPorts {
  const myAddress = over.myAddress ?? `0x${'a'.repeat(64)}`
  return assembleChatViewMessengerPorts({
    composerDraft: {
      message: over.message ?? '',
      recipient: over.recipient ?? '',
      setMessage: vi.fn(),
      setRecipient: vi.fn(),
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
