import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChatViewTransportCardProps } from '@/frontend/hooks/use-chat-view-transport-card-props'
import { testMessengerPorts } from '@/frontend/lib/test-fixtures/messenger-ports'
import type { ChatViewTransportCardPropsDeps } from '@/frontend/hooks/use-chat-view-transport-card-props'

function baseDeps(over: Partial<ChatViewTransportCardPropsDeps> = {}): ChatViewTransportCardPropsDeps {
  const myAddress = '0x' + 'b'.repeat(64)
  const messengerPorts =
    over.messengerPorts ??
    testMessengerPorts({
      messagingPersistenceMode: 'mailbox',
      myAddress,
      partner: '0x' + 'a'.repeat(64),
      isPrivate: over.messengerPorts ? undefined : true,
    })
  return {
    messengerPorts,
    onOpenPartnerSetup: vi.fn(),
    setStatus: vi.fn(),
    setStatusMsg: vi.fn(),
    encryptedPartnerPanelProps: null,
    ...over,
  }
}

describe('useChatViewTransportCardProps', () => {
  it('spiegelt Transport-Wahl und Verschlüsselung', () => {
    const { result } = renderHook(() => useChatViewTransportCardProps(baseDeps()))
    expect(result.current.encrypted).toBe(true)
    expect(result.current.forcedTransport).toBe('internet')
    expect(result.current.messagingPersistenceMode).toBe('mailbox')
  })

  it('setzt myAddressLine nur im Privatmodus', () => {
    const addr = '0x' + 'c'.repeat(64)
    const { result, rerender } = renderHook(
      ({ isPrivate }) =>
        useChatViewTransportCardProps(
          baseDeps({
            messengerPorts: testMessengerPorts({ myAddress: addr, isPrivate }),
          })
        ),
      { initialProps: { isPrivate: true } }
    )
    expect(result.current.myAddressLine).toBe(addr)
    rerender({ isPrivate: false })
    expect(result.current.myAddressLine).toBeUndefined()
  })

  it('reicht encryptedPartner durch wenn gesetzt', () => {
    const partnerProps = {
      partner: '0x' + 'd'.repeat(64),
      onPartnerChange: vi.fn(),
      sending: false,
      onHandshake: vi.fn(),
      onConnectAcceptPartner: vi.fn(),
      onConnectDeployment: vi.fn(),
      directory: {},
    }
    const { result } = renderHook(() =>
      useChatViewTransportCardProps(baseDeps({ encryptedPartnerPanelProps: partnerProps }))
    )
    expect(result.current.encryptedPartner).toBe(partnerProps)
  })
})
