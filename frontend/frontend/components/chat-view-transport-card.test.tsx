import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewTransportCard } from './chat-view-transport-card'

const noop = () => {}

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
})
