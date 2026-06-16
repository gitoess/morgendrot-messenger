import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChatViewSendPanelProps } from '@/frontend/hooks/use-chat-view-send-panel-props'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'
import { testMessengerPorts } from '@/frontend/lib/test-fixtures/messenger-ports'
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
  const setRecipient = vi.fn()
  const isPrivate = over.messengerPorts?.composerSendPath.isPrivate ?? true
  const messengerPorts =
    over.messengerPorts ??
    testMessengerPorts({
      encrypted: true,
      forcedTransport: 'internet',
      composerDelivery: 'chain',
      isPrivate,
      setRecipient,
      myAddress: '0x' + 'c'.repeat(64),
    })
  return {
    messengerPorts,
    setPartner: vi.fn(),
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
          messengerPorts: testMessengerPorts({
            encrypted: true,
            forcedTransport: 'internet',
            composerDelivery: 'chain',
            isPrivate: true,
          }),
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
          setPartner,
          messengerPorts: testMessengerPorts({ isPrivate: true, setRecipient }),
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
          messengerPorts: testMessengerPorts({
            isPrivate: false,
            isGroup: true,
            myAddress: '0x' + 'c'.repeat(64),
          }),
          activeGroup: {
            id: 'g1',
            name: 'Team',
            memberAddresses: [groupAddr],
            teamMailboxObjectId: '0x' + 'f'.repeat(64),
          },
        })
      )
    )
    expect(result.current.sendPanelProps.isGroupChannel).toBe(true)
    expect(result.current.sendPanelProps.groupMemberCount).toBe(1)
  })
})
