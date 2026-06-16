import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChatViewSendPanelProps } from '@/frontend/hooks/use-chat-view-send-panel-props'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'
import type { ChatViewSendPanelPropsDeps } from '@/frontend/hooks/use-chat-view-send-panel-props'

vi.mock('@/frontend/hooks/use-chat-view-telegram-composer', () => ({
  useChatViewTelegramComposer: () => ({
    handleTelegramOnly: vi.fn(),
    canSendTelegramOnly: false,
    telegramOnlyBusy: false,
  }),
}))

vi.mock('@/frontend/hooks/use-encrypted-recipient-handshake-status', () => ({
  useEncryptedRecipientHandshakeStatus: () => ({
    status: 'ready',
    blocksSend: false,
    refresh: vi.fn(),
  }),
}))

function baseDeps(over: Partial<ChatViewSendPanelPropsDeps> = {}): ChatViewSendPanelPropsDeps {
  return {
    message: 'Hallo',
    setMessage: vi.fn(),
    recipient: '0x' + 'a'.repeat(64),
    setRecipient: vi.fn(),
    partner: '0x' + 'b'.repeat(64),
    setPartner: vi.fn(),
    encrypted: true,
    forcedTransport: 'internet',
    meshLoRaImagesEnabled: false,
    setMeshLoRaImagesEnabled: vi.fn(),
    meshSelfArchiveAfterLoRa: false,
    setMeshSelfArchiveAfterLoRa: vi.fn(),
    isPrivate: true,
    isGroup: false,
    activeGroup: null,
    sending: false,
    loraOnlineFallbackOffer: null,
    confirmLoraSendViaOnline: vi.fn(),
    dismissLoraOnlineFallback: vi.fn(),
    apiStatus: TEST_API_STATUS_SEND_READY as ChatViewSendPanelPropsDeps['apiStatus'],
    handleSend: vi.fn(),
    cancelSend: vi.fn(),
    status: 'idle',
    statusMsg: '',
    setStatus: vi.fn(),
    setStatusMsg: vi.fn(),
    offlineMailboxQueuePending: 0,
    offlineMailboxQueueUntrustedTimeCount: 0,
    offlineMailboxQueueBackoffCount: 0,
    offlineMailboxQueueItems: [],
    removeOfflineMailboxQueueItems: vi.fn(),
    meshPlaintextToNodeEnabled: false,
    setMeshPlaintextToNodeEnabled: vi.fn(),
    meshPlaintextNodeId: '',
    setMeshPlaintextNodeId: vi.fn(),
    setMeshtasticChannelIndex: vi.fn(),
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
    sosVoiceAwaitingSend: false,
    compactFileRef: { current: null },
    compactBusy: false,
    attachmentPipelineHint: null,
    handleCompactAttachmentPick: vi.fn(),
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
    loadMessages: vi.fn(),
    directory: {},
    myAddress: '0x' + 'c'.repeat(64),
    composerDelivery: 'chain',
    messagingPersistenceMode: 'mailbox',
    setComposerMailboxObjectId: vi.fn(),
    appendMeshMessage: vi.fn(),
    handleHandshakeForAddress: vi.fn(),
    handleConnectAcceptForAddress: vi.fn(),
    expertTools: false,
    canPostToPinnwand: false,
    handshakeConnectedAddresses: [],
    pendingHandshakeOffers: [],
    outgoingHandshakeOffers: [],
    reloadPendingHandshakes: vi.fn(),
    ...over,
  }
}

describe('useChatViewSendPanelProps', () => {
  it('blendet Composer-0x bei verschlüsseltem Online-Chain-Pfad aus', () => {
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(
        baseDeps({
          isPrivate: true,
          encrypted: true,
          forcedTransport: 'internet',
          composerDelivery: 'chain',
        })
      )
    )
    expect(result.current.sendPanelProps.hideComposerIotaRecipient).toBe(true)
  })

  it('syncPartnerAndRecipient setzt Partner und bei Privat auch Recipient', () => {
    const setPartner = vi.fn()
    const setRecipient = vi.fn()
    const addr = '0x' + 'd'.repeat(64)
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(
        baseDeps({
          isPrivate: true,
          setPartner,
          setRecipient,
        })
      )
    )
    act(() => {
      result.current.syncPartnerAndRecipient(`  ${addr}  `)
    })
    expect(setPartner).toHaveBeenCalledWith(addr)
    expect(setRecipient).toHaveBeenCalledWith(addr)
  })

  it('onStatusFeedback aktualisiert Status im Core', () => {
    const setStatus = vi.fn()
    const setStatusMsg = vi.fn()
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(baseDeps({ setStatus, setStatusMsg }))
    )
    act(() => {
      result.current.sendPanelProps.onStatusFeedback?.('Gesendet', 'success')
    })
    expect(setStatus).toHaveBeenCalledWith('success')
    expect(setStatusMsg).toHaveBeenCalledWith('Gesendet')
  })

  it('setzt Gruppen-Felder aus buildGroupSendPanelContext', () => {
    const groupAddr = '0x' + 'e'.repeat(64)
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(
        baseDeps({
          isPrivate: false,
          isGroup: true,
          activeGroup: {
            id: 'g1',
            name: 'Team',
            memberAddresses: [groupAddr],
            teamMailboxObjectId: '0x' + 'f'.repeat(64),
          },
          myAddress: '0x' + 'c'.repeat(64),
        })
      )
    )
    expect(result.current.sendPanelProps.isGroupChannel).toBe(true)
    expect(result.current.sendPanelProps.groupMemberCount).toBe(1)
  })
})
