import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewTransportCard, type ChatViewTransportCardProps } from './chat-view-transport-card'

const noop = () => {}

const PEER_A = `0x${'a'.repeat(64)}`
const PEER_B = `0x${'b'.repeat(64)}`

function baseProps(over: Partial<ChatViewTransportCardProps> = {}): ChatViewTransportCardProps {
  return {
    isPrivate: true,
    encrypted: true,
    onEncryptedChange: vi.fn(),
    forcedTransport: 'internet' as const,
    onForcedTransportChange: noop,
    messagingPersistenceMode: 'event' as const,
    onMessagingPersistenceModeChange: noop,
    apiStatus: null,
    ...over,
  }
}

describe('ChatViewTransportCard (Sendepfad / Partner-UI)', () => {
  it('zeigt bei Funk minimalen Status und öffnet Partner-Setup', () => {
    const onOpenPartnerSetup = vi.fn()
    render(
      <ChatViewTransportCard
        isPrivate
        encrypted
        onEncryptedChange={noop}
        forcedTransport="mesh"
        onForcedTransportChange={noop}
        messagingPersistenceMode="event"
        onMessagingPersistenceModeChange={noop}
        apiStatus={null}
        meshBleSupported
        meshBleConnected={false}
        onOpenPartnerSetup={onOpenPartnerSetup}
      />
    )
    expect(screen.queryByText(/Policy:/i)).not.toBeInTheDocument()
    screen.getByRole('button', { name: /Funk.*Geräte/i }).click()
    expect(onOpenPartnerSetup).toHaveBeenCalledTimes(1)
  })

  it('zeigt Ad-hoc-BLE-Platzhalter und Setup-Button', () => {
    const onOpenPartnerSetup = vi.fn()
    render(
      <ChatViewTransportCard
        isPrivate
        encrypted
        onEncryptedChange={noop}
        forcedTransport="adhoc"
        onForcedTransportChange={noop}
        messagingPersistenceMode="event"
        onMessagingPersistenceModeChange={noop}
        apiStatus={null}
        onOpenPartnerSetup={onOpenPartnerSetup}
      />
    )
    expect(screen.getByText(/Ad-hoc BLE/)).toBeInTheDocument()
    expect(screen.getByText(/bleUuid/)).toBeInTheDocument()
    screen.getByRole('button', { name: /Setup öffnen/i }).click()
    expect(onOpenPartnerSetup).toHaveBeenCalledTimes(1)
  })

  it('deaktiviert Verschlüsselt bei Funk (§ H.1a)', () => {
    render(
      <ChatViewTransportCard
        {...baseProps({
          forcedTransport: 'mesh',
          encrypted: false,
        })}
      />
    )
    expect(screen.getByRole('button', { name: /^Verschlüsselt$/i })).toBeDisabled()
  })

  it('warnt vor Klartext-Wechsel per Dialog (§ H.1a)', () => {
    const onEncryptedChange = vi.fn()
    render(
      <ChatViewTransportCard
        {...baseProps({
          onEncryptedChange,
          encrypted: true,
          forcedTransport: 'internet',
        })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Unverschlüsselt/i }))
    expect(screen.getByText(/Unverschlüsselt senden/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Verstanden, fortfahren/i }))
    expect(onEncryptedChange).toHaveBeenCalledWith(false)
  })

  it('warnt bei mehreren Partnern ohne Ziel-0x (§ H.1a)', () => {
    render(
      <ChatViewTransportCard
        {...baseProps({
          partner: '',
          composerRecipient: '',
          apiStatus: {
            connected: true,
            connectedAddresses: [PEER_A, PEER_B],
          },
        })}
      />
    )
    expect(screen.getByText(/Mehrere Partner verbunden/i)).toBeInTheDocument()
    expect(screen.getByText(/Empfängerfeld/i)).toBeInTheDocument()
  })

  it('kein Warnhinweis wenn Empfängerfeld verbundene 0x enthält', () => {
    render(
      <ChatViewTransportCard
        {...baseProps({
          partner: '',
          composerRecipient: PEER_A,
          apiStatus: {
            connected: true,
            connectedAddresses: [PEER_A, PEER_B],
          },
        })}
      />
    )
    expect(screen.queryByText(/Mehrere Partner verbunden/i)).not.toBeInTheDocument()
  })

  it('zeigt Messenger-Credits-Balken wenn konfiguriert (§ H.1a)', () => {
    render(
      <ChatViewTransportCard
        {...baseProps({
          apiStatus: {
            messengerCreditsConfigured: true,
            messengerCredits: { balance: '50', maxBalance: '100' },
          },
        })}
      />
    )
    expect(screen.getByText(/Messenger-Credits/i)).toBeInTheDocument()
    expect(screen.getByText(/50 \/ 100/)).toBeInTheDocument()
  })
})
