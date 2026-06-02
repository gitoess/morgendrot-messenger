import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewSendPathCompact } from './chat-view-send-path-compact'

const noop = () => {}

describe('ChatViewSendPathCompact', () => {
  it('blendet adhoc aus wenn showAdhocTransport false', () => {
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted={false}
        forcedTransport="mesh"
        onForcedTransportChange={noop}
        showAdhocTransport={false}
      />
    )
    expect(screen.getByRole('button', { name: /funk/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /online/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /adhoc/i })).not.toBeInTheDocument()
  })

  it('zeigt adhoc standardmäßig', () => {
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted={false}
        forcedTransport="mesh"
        onForcedTransportChange={noop}
      />
    )
    expect(screen.getByRole('button', { name: /adhoc/i })).toBeInTheDocument()
  })

  it('zeigt Verschlüsselungs-Hinweis bei funk', () => {
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted={false}
        forcedTransport="mesh"
        onForcedTransportChange={noop}
      />
    )
    expect(screen.getByRole('note')).toHaveTextContent(/Meshtastic-Kanal/)
  })

  it('telegram setzt nur delivery (nicht forcedTransport — der Wrapper würde chain erzwingen)', () => {
    const onDelivery = vi.fn()
    const onTransport = vi.fn()
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted={false}
        forcedTransport="mesh"
        onForcedTransportChange={onTransport}
        composerDelivery="chain"
        onComposerDeliveryChange={onDelivery}
      />
    )
    screen.getByRole('button', { name: /telegram/i }).click()
    expect(onDelivery).toHaveBeenCalledWith('telegram')
    expect(onTransport).not.toHaveBeenCalled()
  })
})
