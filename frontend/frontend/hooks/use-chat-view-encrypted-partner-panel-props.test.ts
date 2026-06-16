import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChatViewEncryptedPartnerPanelProps } from '@/frontend/hooks/use-chat-view-encrypted-partner-panel-props'
import type { ChatViewEncryptedPartnerPanelPropsDeps } from '@/frontend/hooks/use-chat-view-encrypted-partner-panel-props'
import { testMessengerPorts } from '@/frontend/lib/test-fixtures/messenger-ports'

function baseDeps(over: Partial<ChatViewEncryptedPartnerPanelPropsDeps> = {}): ChatViewEncryptedPartnerPanelPropsDeps {
  const myAddress = '0x' + 'b'.repeat(64)
  const partner = '0x' + 'a'.repeat(64)
  const messengerPorts =
    over.messengerPorts ??
    testMessengerPorts({
      partner,
      myAddress,
      encrypted: true,
      forcedTransport: 'internet',
      composerDelivery: 'chain',
      channelMode: 'private',
      isGroup: false,
    })
  return {
    messengerPorts,
    setStatusMsg: vi.fn(),
    ...over,
  }
}

describe('useChatViewEncryptedPartnerPanelProps', () => {
  it('liefert Props bei Privat + verschlüsselt + online + chain', () => {
    const { result } = renderHook(() => useChatViewEncryptedPartnerPanelProps(baseDeps()))
    expect(result.current.showEncryptedPartnerPanel).toBe(true)
    expect(result.current.encryptedPartnerPanelProps?.partner).toMatch(/^0x/)
    expect(result.current.encryptedPartnerPanelProps?.isGroupMode).toBe(false)
  })

  it('liefert null bei Klartext', () => {
    const { result } = renderHook(() =>
      useChatViewEncryptedPartnerPanelProps(
        baseDeps({
          messengerPorts: testMessengerPorts({ encrypted: false }),
        })
      )
    )
    expect(result.current.showEncryptedPartnerPanel).toBe(false)
    expect(result.current.encryptedPartnerPanelProps).toBeNull()
  })

  it('liefert null bei Funk-Transport', () => {
    const { result } = renderHook(() =>
      useChatViewEncryptedPartnerPanelProps(
        baseDeps({
          messengerPorts: testMessengerPorts({ forcedTransport: 'mesh' }),
        })
      )
    )
    expect(result.current.encryptedPartnerPanelProps).toBeNull()
  })

  it('setzt Gruppenmitglieder im Gruppenmodus', () => {
    const member = '0x' + 'c'.repeat(64)
    const { result } = renderHook(() =>
      useChatViewEncryptedPartnerPanelProps(
        baseDeps({
          messengerPorts: testMessengerPorts({
            channelMode: 'group',
            isGroup: true,
          }),
          activeGroupMemberAddresses: [member],
        })
      )
    )
    expect(result.current.encryptedPartnerPanelProps?.isGroupMode).toBe(true)
    expect(result.current.encryptedPartnerPanelProps?.groupMemberAddresses).toEqual([member])
  })
})
