import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  ChatViewChatHeader,
  TresorSessionBadge,
  type ChatViewChatHeaderProps,
} from '@/frontend/components/chat-view-chat-header'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'
import { setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

function baseHeader(over: Partial<ChatViewChatHeaderProps> = {}): ChatViewChatHeaderProps {
  return {
    isPrivate: true,
    encrypted: true,
    apiStatus: TEST_API_STATUS_SEND_READY,
    basisUnreachable: false,
    meshBleConnected: false,
    role: 'consumer',
    ...over,
  }
}

describe('TresorSessionBadge (§ H.1a)', () => {
  it('zeigt gesperrt / Keys fehlen / bereit', () => {
    setVaultPasswordSession('vault-pass-99')
    const { rerender } = render(<TresorSessionBadge sessionLocked hasKeys={false} />)
    expect(screen.getByText(/Tresor: gesperrt/)).toBeInTheDocument()

    rerender(<TresorSessionBadge sessionLocked={false} hasKeys={false} />)
    expect(screen.getByText(/Tresor: PW tippen/)).toBeInTheDocument()

    rerender(<TresorSessionBadge sessionLocked={false} hasKeys />)
    expect(screen.getByText(/Tresor: bereit/)).toBeInTheDocument()
  })

  it('öffnet Unlock wenn gesperrt und Aktion gesetzt', () => {
    const onNavigateHomeWhenLocked = vi.fn()
    render(
      <TresorSessionBadge
        sessionLocked
        hasKeys={false}
        actions={{ onLockSession: vi.fn(), onNavigateHomeWhenLocked }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Tresor-Passwort eingeben/i }))
    expect(onNavigateHomeWhenLocked).toHaveBeenCalledTimes(1)
  })

  it('sperrt Sitzung wenn bereit und Vault-Sitzung offen', async () => {
    setVaultPasswordSession('vault-pass-99')
    const onLockSession = vi.fn().mockResolvedValue(undefined)
    render(
      <TresorSessionBadge
        sessionLocked={false}
        hasKeys
        actions={{ onLockSession, onNavigateHomeWhenLocked: vi.fn() }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Tresor sperren/i }))
    expect(onLockSession).toHaveBeenCalledTimes(1)
  })

  it('ohne Tresor-Sitzung: Badge „Tresor: Passwort“ öffnet Sync statt zu sperren', () => {
    setVaultPasswordSession(null)
    const onNavigateHomeWhenLocked = vi.fn()
    const onLockSession = vi.fn()
    render(
      <TresorSessionBadge
        sessionLocked={false}
        hasKeys
        actions={{ onLockSession, onNavigateHomeWhenLocked }}
      />
    )
    expect(screen.getByText(/Tresor: Passwort/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Tresor-Passwort eingeben/i }))
    expect(onNavigateHomeWhenLocked).toHaveBeenCalledTimes(1)
    expect(onLockSession).not.toHaveBeenCalled()
  })
})

describe('ChatViewChatHeader (§ H.1a)', () => {
  it('zeigt Kontext-Titel und Sendepfad oben', () => {
    render(
      <ChatViewChatHeader
        {...baseHeader({
          channelMode: 'private',
          conversationTitle: 'Chat mit Max',
          conversationSubtitle: '0xabc',
          sendPath: {
            visible: true,
            channelMode: 'private',
            encrypted: true,
            forcedTransport: 'internet',
            onForcedTransportChange: vi.fn(),
          },
        })}
      />
    )
    expect(screen.getByRole('heading', { name: /Chat mit Max/i })).toBeInTheDocument()
    expect(screen.getByText('0xabc')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Alle$/i })).toBeInTheDocument()
  })

  it('verlinkt Handbuch direkt ins Messenger-Handbuch', () => {
    render(<ChatViewChatHeader {...baseHeader({ channelMode: 'private' })} />)
    const link = screen.getByRole('link', { name: /Messenger-Handbuch/i })
    expect(link).toHaveAttribute('href', '/handbook?file=MESSENGER-CHAT-HANDBUCH.md')
  })

  it('zeigt Einstellungen-Button wenn Callback gesetzt', () => {
    render(
      <ChatViewChatHeader
        {...baseHeader({
          channelMode: 'private',
          onOpenSettings: vi.fn(),
        })}
      />
    )
    expect(screen.getByRole('button', { name: /Einstellungen/i })).toBeInTheDocument()
  })

  it('zeigt Aktualisieren neben Tresor wenn onRefreshStatus gesetzt', () => {
    const onRefreshStatus = vi.fn()
    render(
      <ChatViewChatHeader
        {...baseHeader({
          channelMode: 'private',
          onRefreshStatus,
          suppressAppChrome: true,
        })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^Aktualisieren$/i }))
    expect(onRefreshStatus).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Tresor:/i)).toBeInTheDocument()
  })

  it('warnt bei unsicherer Geräte-Uhr (§ H.6c)', () => {
    render(<ChatViewChatHeader {...baseHeader({ deviceTimeTrustWarn: true })} />)
    expect(screen.getByText(/Geräte-Uhr:/)).toBeInTheDocument()
  })

  it('zeigt Warteschlange nur bei echter Offline + Queue', () => {
    render(
      <ChatViewChatHeader
        {...baseHeader({
          basisUnreachable: true,
          statusPollAttempted: true,
          offlineStatus: {
            mode: 'offline',
            queuePending: 2,
            lastSuccessfulSyncMinutes: 5,
            queueEnabled: true,
            localHandoffOnly: false,
            restrictedFeatures: [],
          },
        })}
      />
    )
    expect(screen.getByText(/Warteschlange:/)).toBeInTheDocument()
    expect(screen.queryByText(/Offline-Status:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Offline \(Cache-Modus\)/)).not.toBeInTheDocument()
  })
})
