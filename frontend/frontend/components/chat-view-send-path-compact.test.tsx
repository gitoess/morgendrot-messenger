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

  it('zeigt keinen Verschlüsselungs-Hinweis bei funk klartext', () => {
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted={false}
        forcedTransport="mesh"
        onForcedTransportChange={noop}
      />
    )
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('deaktiviert Sendepfad bei fehlender Schreibberechtigung', () => {
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted={false}
        forcedTransport="mesh"
        onForcedTransportChange={noop}
        onComposerDeliveryChange={noop}
        apiStatus={{
          roleId: 12,
          capabilities: {
            version: 1,
            roleId: 12,
            simpleMode: true,
            product: {
              canCreateGroup: false,
              canInviteMembers: false,
              canExportData: false,
              canManageEinsatzTemplates: false,
            },
            transport: {
              lora: { read: true, write: true },
              telegram: { read: true, write: false },
              iota: { read: true, write: false },
              ble: { read: true, write: true },
              streams: { read: true, write: false },
            },
            security: { forceEncryptionOnly: false, allowPlaintextFallback: true },
          },
        }}
      />
    )
    expect(screen.getByRole('button', { name: /online/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /funk/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /telegram/i })).toBeDisabled()
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

  it('rendert nichts wenn visible=false (§ H.1a)', () => {
    const { container } = render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible={false}
        encrypted={false}
        forcedTransport="mesh"
        onForcedTransportChange={noop}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('Pinnwand: funk deaktiviert, online aktiv (§ H.1a)', () => {
    render(
      <ChatViewSendPathCompact
        channelMode="pinnwand"
        visible
        encrypted={false}
        forcedTransport="internet"
        onForcedTransportChange={noop}
        onComposerDeliveryChange={noop}
      />
    )
    expect(screen.getByRole('button', { name: /online/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /funk/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /telegram/i })).not.toBeInTheDocument()
  })

  it('Gruppe: telegram ausgeblendet, funk aktiv (§ H.1a)', () => {
    render(
      <ChatViewSendPathCompact
        channelMode="group"
        visible
        encrypted={false}
        forcedTransport="mesh"
        onForcedTransportChange={noop}
        onComposerDeliveryChange={noop}
      />
    )
    expect(screen.getByRole('button', { name: /funk/i })).not.toBeDisabled()
    expect(screen.queryByRole('button', { name: /telegram/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adhoc/i })).toBeDisabled()
  })

  it('zeigt Verschlüsselungs-Hinweis bei Online + Schloss (§ H.1a)', () => {
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted
        forcedTransport="internet"
        onForcedTransportChange={noop}
      />
    )
    expect(screen.getByRole('note')).toHaveTextContent(/Verschlüsselung/)
  })

  it('Online-Klick setzt forcedTransport internet (§ H.1a)', () => {
    const onTransport = vi.fn()
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted={false}
        forcedTransport="mesh"
        onForcedTransportChange={onTransport}
        onComposerDeliveryChange={noop}
      />
    )
    screen.getByRole('button', { name: /online/i }).click()
    expect(onTransport).toHaveBeenCalledWith('internet')
  })

  it('Funk-Klick bei Klartext setzt mesh (§ H.1a)', () => {
    const onTransport = vi.fn()
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted={false}
        forcedTransport="internet"
        onForcedTransportChange={onTransport}
        onComposerDeliveryChange={noop}
      />
    )
    screen.getByRole('button', { name: /funk/i }).click()
    expect(onTransport).toHaveBeenCalledWith('mesh')
  })

  it('Telegram-Modus zeigt Zustell-Hinweis (§ H.1a)', () => {
    render(
      <ChatViewSendPathCompact
        channelMode="private"
        visible
        encrypted={false}
        forcedTransport="internet"
        composerDelivery="telegram"
        onForcedTransportChange={noop}
        onComposerDeliveryChange={noop}
      />
    )
    expect(screen.getByRole('note')).toHaveTextContent(/Telegram/)
  })
})
