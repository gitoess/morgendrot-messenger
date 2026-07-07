import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChatViewSendPanelProps } from '@/frontend/hooks/use-chat-view-send-panel-props'
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
    activeGroup: null,
    expertTools: false,
    canPostToPinnwand: false,
    ...over,
  }
}

describe('useChatViewSendPanelProps', () => {
  it('blendet Composer-0x bei aktivem 1:1-Chat aus', () => {
    const addr = '0x' + 'd'.repeat(64)
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(
        baseDeps({
          messengerPorts: testMessengerPorts({
            encrypted: false,
            forcedTransport: 'internet',
            composerDelivery: 'chain',
            isPrivate: true,
            partner: addr,
            recipient: addr,
          }),
          activeConversation: {
            inboxPartnerKey: addr,
            inboxConversationGroupId: null,
            inboxPartnerFiltersArmed: true,
            directory: { [addr]: { label: 'Alice' } },
          },
        })
      )
    )
    expect(result.current.sendPanelProps.hideComposerIotaRecipient).toBe(true)
    expect(result.current.sendPanelProps.activeConversationBar?.displayName).toBe('Alice')
  })

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
    const ports = testMessengerPorts({ isPrivate: true, setRecipient })
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(
        baseDeps({
          messengerPorts: {
            ...ports,
            composerPartner: { ...ports.composerPartner, onPartnerChange: setPartner },
          },
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
    const ports = testMessengerPorts()
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(
        baseDeps({
          messengerPorts: {
            ...ports,
            sendActions: {
              ...ports.sendActions,
              onStatusChange: setStatus,
              onStatusMsgChange: setStatusMsg,
              onStatusFeedback: (msg, st = 'success') => {
                setStatus(st)
                setStatusMsg(msg)
              },
            },
          },
        })
      )
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

  it('zeigt Verschlüsselt/Klartext-Leiste bei IOTA „Alle“-Broadcast', () => {
    const a = '0x' + 'a'.repeat(64)
    const b = '0x' + 'b'.repeat(64)
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(
        baseDeps({
          messengerPorts: testMessengerPorts({
            encrypted: true,
            forcedTransport: 'internet',
            composerDelivery: 'chain',
            isPrivate: true,
            partner: a,
            recipient: `${a}, ${b}`,
          }),
          activeConversation: {
            inboxPartnerKey: null,
            inboxConversationGroupId: null,
            inboxPartnerFiltersArmed: false,
            directory: {},
          },
        })
      )
    )
    expect(result.current.sendPanelProps.hideComposerIotaRecipient).toBe(false)
    expect(result.current.sendPanelProps.activeConversationBar?.displayName).toBe('Alle · 2 Empfänger')
    expect(result.current.sendPanelProps.activeConversationBar?.onEncryptedChange).toBeDefined()
  })

  it('zeigt Verschlüsselungs-Leiste bei aktiver Gruppe', () => {
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(
        baseDeps({
          messengerPorts: testMessengerPorts({
            encrypted: true,
            forcedTransport: 'internet',
            composerDelivery: 'chain',
            isPrivate: false,
            isGroup: true,
          }),
          activeGroup: {
            id: 'g1',
            name: 'Einsatz Alpha',
            memberAddresses: ['0x' + 'a'.repeat(64)],
          },
          activeConversation: {
            inboxPartnerKey: null,
            inboxConversationGroupId: 'g1',
            inboxPartnerFiltersArmed: true,
            directory: {},
          },
        })
      )
    )
    expect(result.current.sendPanelProps.activeConversationBar?.displayName).toBe('Einsatz Alpha')
    expect(result.current.sendPanelProps.encryptionModeToggle).toBeUndefined()
  })

  it('liefert encryptionModeToggle wenn keine Konversationsleiste', () => {
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
    expect(result.current.sendPanelProps.activeConversationBar).toBeUndefined()
    expect(result.current.sendPanelProps.encryptionModeToggle?.onEncryptedChange).toBeDefined()
  })

  it('spiegelt attachmentBar aus messengerPorts', () => {
    const clearCompactAttachment = vi.fn()
    const { result } = renderHook(() =>
      useChatViewSendPanelProps(
        baseDeps({
          messengerPorts: testMessengerPorts({
            attachmentBar: {
              sending: true,
              setSending: vi.fn(),
              compactFileRef: { current: null },
              compactBusy: true,
              attachmentPipelineHint: 'Pipeline',
              onFileChange: vi.fn(),
              ingestChatAttachmentFile: vi.fn(async () => {}),
              compactMeta: null,
              attachedBlobBase64: null,
              attachedLora: null,
              attachedTxtFile: null,
              attachedAudioBase64: null,
              clearCompactAttachment,
              compactPreviewUrl: null,
              loraPreviewUrl: null,
              loraMeshProgressLine: null,
            },
          }),
        })
      )
    )
    expect(result.current.sendPanelProps.sending).toBe(true)
    expect(result.current.sendPanelProps.compactBusy).toBe(true)
    expect(result.current.sendPanelProps.attachmentPipelineHint).toBe('Pipeline')
    result.current.sendPanelProps.clearCompactAttachment()
    expect(clearCompactAttachment).toHaveBeenCalled()
  })
})
