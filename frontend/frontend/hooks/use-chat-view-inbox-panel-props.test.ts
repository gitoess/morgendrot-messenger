import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChatViewInboxPanelProps } from '@/frontend/hooks/use-chat-view-inbox-panel-props'
import type { ChatViewInboxPanelPropsDeps } from '@/frontend/hooks/use-chat-view-inbox-panel-props'
import { testPanelMessengerPorts } from '@/frontend/lib/test-fixtures/messenger-ports'

vi.mock('@/frontend/components/chat-view-inbox-package-expert-menu', () => ({
  ChatViewInboxPackageExpertMenu: () => null,
}))

function baseDeps(over: Partial<ChatViewInboxPanelPropsDeps> = {}): ChatViewInboxPanelPropsDeps {
  return {
    messengerPorts: over.messengerPorts ?? testPanelMessengerPorts(),
    showPinnwandPinActions: false,
    onOpenPhonebook: vi.fn(),
    showInboxIotaFilter: false,
    showIotaExpertInboxActions: false,
    pinnwandOverviewConfigured: false,
    showInboxPackageExpertMenu: false,
    ...over,
  }
}

describe('useChatViewInboxPanelProps', () => {
  it('setzt messageCount und inboxRowCount', () => {
    const ports = testPanelMessengerPorts()
    const messengerPorts = {
      ...ports,
      inboxPanelRead: {
        ...ports.inboxPanelRead,
        inboxTotalCount: 42,
        inboxRows: [{ id: '1' } as never],
      },
    }
    const { result } = renderHook(() =>
      useChatViewInboxPanelProps(
        baseDeps({
          messengerPorts,
        })
      )
    )
    expect(result.current.messageCount).toBe(42)
    expect(result.current.inboxRowCount).toBe(1)
  })

  it('ohne Expert-Menü bleibt inboxPackageExpertMenu null', () => {
    const { result } = renderHook(() =>
      useChatViewInboxPanelProps(baseDeps({ showInboxPackageExpertMenu: false }))
    )
    expect(result.current.showInboxPackageExpertMenu).toBe(false)
    expect(result.current.inboxPackageExpertMenu).toBeNull()
  })

  it('onRefresh lädt Posteingang mit forceLive', () => {
    const loadMessages = vi.fn()
    const refreshContactDirectory = vi.fn()
    const reload = vi.fn()
    const ports = testPanelMessengerPorts()
    const messengerPorts = {
      ...ports,
      inboxActions: { ...ports.inboxActions, loadMessages, refreshContactDirectory },
      handshakeOffersRead: { ...ports.handshakeOffersRead, reload },
    }
    const { result } = renderHook(() =>
      useChatViewInboxPanelProps(baseDeps({ messengerPorts }))
    )
    result.current.onRefresh()
    expect(loadMessages).toHaveBeenCalledWith('reset', undefined, { forceLive: true })
    expect(refreshContactDirectory).toHaveBeenCalled()
    expect(reload).toHaveBeenCalled()
  })

  it('onApplySendRecipient setzt Recipient und Partner-Strip', () => {
    const onRecipientChange = vi.fn()
    const onSelectPartner = vi.fn()
    const addr = '0x' + 'b'.repeat(64)
    const ports = testPanelMessengerPorts({ myAddress: `0x${'a'.repeat(64)}` })
    const messengerPorts = {
      ...ports,
      composerDraft: { ...ports.composerDraft, onRecipientChange },
      inboxViewUi: { ...ports.inboxViewUi, selectInboxPartnerForSend: onSelectPartner },
    }
    const { result } = renderHook(() =>
      useChatViewInboxPanelProps(baseDeps({ messengerPorts }))
    )
    result.current.onApplySendRecipient?.(addr)
    expect(onRecipientChange).toHaveBeenCalledWith(addr)
    expect(onSelectPartner).toHaveBeenCalledWith(addr)
  })
})
