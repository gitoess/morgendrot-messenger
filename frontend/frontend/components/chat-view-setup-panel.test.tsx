import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  ChatViewSetupPanel,
  type ChatViewSetupPanelMeshtastic,
  type ChatViewSetupPanelProps,
} from '@/frontend/components/chat-view-setup-panel'

vi.mock('@/frontend/lib/api', () => ({
  saveContactEntry: vi.fn().mockResolvedValue({ ok: true, message: 'Gespeichert' }),
}))

function meshtastic(over: Partial<ChatViewSetupPanelMeshtastic> = {}): ChatViewSetupPanelMeshtastic {
  return {
    bleSupported: true,
    serialSupported: true,
    transportKind: 'bluetooth',
    connected: false,
    connecting: false,
    error: null,
    connect: vi.fn(),
    connectBluetooth: vi.fn(),
    connectUsb: vi.fn(),
    disconnect: vi.fn(),
    ...over,
  }
}

function baseProps(over: Partial<ChatViewSetupPanelProps> = {}): ChatViewSetupPanelProps {
  return {
    forcedTransport: 'mesh',
    meshtastic: meshtastic(),
    refreshContactDirectory: vi.fn(),
    contactBleAddress: '',
    onContactBleAddressChange: vi.fn(),
    contactBleUuid: '',
    onContactBleUuidChange: vi.fn(),
    contactBleBusy: false,
    setContactBleBusy: vi.fn(),
    meshSyncMsg: null,
    setMeshSyncMsg: vi.fn(),
    ...over,
  }
}

describe('ChatViewSetupPanel (§ H.1b)', () => {
  it('rendert nichts bei Internet-Sendepfad', () => {
    const { container } = render(<ChatViewSetupPanel {...baseProps({ forcedTransport: 'internet' })} />)
    expect(container.firstChild).toBeNull()
  })

  it('zeigt Funk & Geräte bei Meshtastic-Sendepfad', () => {
    render(<ChatViewSetupPanel {...baseProps({ forcedTransport: 'mesh' })} />)
    expect(screen.getByRole('heading', { name: /Funk & Geräte/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bluetooth verbinden/i })).toBeInTheDocument()
  })

  it('zeigt Meshtastic verbunden mit Trennen', () => {
    const disconnect = vi.fn()
    render(
      <ChatViewSetupPanel
        {...baseProps({
          forcedTransport: 'mesh',
          meshtastic: meshtastic({ connected: true, disconnect }),
        })}
      />
    )
    expect(screen.getByText(/Meshtastic verbunden/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Trennen/i }))
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('zeigt Ad-hoc BLE-Sektion', () => {
    render(<ChatViewSetupPanel {...baseProps({ forcedTransport: 'adhoc' })} />)
    expect(screen.getByRole('heading', { name: /Ad-hoc · BLE-Gerät/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/64 Hex/i)).toBeInTheDocument()
  })

  it('zeigt meshSyncMsg außerhalb LoRa', () => {
    render(
      <ChatViewSetupPanel
        {...baseProps({ forcedTransport: 'adhoc', meshSyncMsg: 'Kontakt gespeichert.' })}
      />
    )
    expect(screen.getByText(/Kontakt gespeichert/i)).toBeInTheDocument()
  })
})
