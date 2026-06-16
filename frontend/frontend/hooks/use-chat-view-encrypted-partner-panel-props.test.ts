import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChatViewEncryptedPartnerPanelProps } from '@/frontend/hooks/use-chat-view-encrypted-partner-panel-props'
import type { ChatViewEncryptedPartnerPanelPropsDeps } from '@/frontend/hooks/use-chat-view-encrypted-partner-panel-props'

function baseDeps(over: Partial<ChatViewEncryptedPartnerPanelPropsDeps> = {}): ChatViewEncryptedPartnerPanelPropsDeps {
  return {
    channelMode: 'private',
    isGroup: false,
    composerDelivery: 'chain',
    encrypted: true,
    forcedTransport: 'internet',
    partner: '0x' + 'a'.repeat(64),
    onPartnerChange: vi.fn(),
    sending: false,
    onHandshake: vi.fn(),
    onConnectAcceptPartner: vi.fn(),
    onConnectDeployment: vi.fn(),
    onConnectAcceptForAddress: vi.fn(),
    directory: {},
    connectedAddresses: [],
    onHandshakeForAddress: vi.fn(),
    myAddress: '0x' + 'b'.repeat(64),
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
      useChatViewEncryptedPartnerPanelProps(baseDeps({ encrypted: false }))
    )
    expect(result.current.showEncryptedPartnerPanel).toBe(false)
    expect(result.current.encryptedPartnerPanelProps).toBeNull()
  })

  it('liefert null bei Funk-Transport', () => {
    const { result } = renderHook(() =>
      useChatViewEncryptedPartnerPanelProps(baseDeps({ forcedTransport: 'mesh' }))
    )
    expect(result.current.encryptedPartnerPanelProps).toBeNull()
  })

  it('setzt Gruppenmitglieder im Gruppenmodus', () => {
    const member = '0x' + 'c'.repeat(64)
    const { result } = renderHook(() =>
      useChatViewEncryptedPartnerPanelProps(
        baseDeps({
          channelMode: 'group',
          isGroup: true,
          activeGroupMemberAddresses: [member],
        })
      )
    )
    expect(result.current.encryptedPartnerPanelProps?.isGroupMode).toBe(true)
    expect(result.current.encryptedPartnerPanelProps?.groupMemberAddresses).toEqual([member])
  })
})
