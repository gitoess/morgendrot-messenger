import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  ChatViewChatHeader,
  TresorSessionBadge,
  type ChatViewChatHeaderProps,
} from '@/frontend/components/chat-view-chat-header'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'

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
    const { rerender } = render(<TresorSessionBadge sessionLocked hasKeys={false} />)
    expect(screen.getByText(/Tresor: gesperrt/)).toBeInTheDocument()

    rerender(<TresorSessionBadge sessionLocked={false} hasKeys={false} />)
    expect(screen.getByText(/Tresor: Keys fehlen/)).toBeInTheDocument()

    rerender(<TresorSessionBadge sessionLocked={false} hasKeys />)
    expect(screen.getByText(/Tresor: bereit/)).toBeInTheDocument()
  })

  it('navigiert zur Startseite wenn gesperrt und Aktion gesetzt', () => {
    const onNavigateHomeWhenLocked = vi.fn()
    render(
      <TresorSessionBadge
        sessionLocked
        hasKeys={false}
        actions={{ onLockSession: vi.fn(), onNavigateHomeWhenLocked }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Tresor entsperren/i }))
    expect(onNavigateHomeWhenLocked).toHaveBeenCalledTimes(1)
  })

  it('sperrt Sitzung wenn bereit und Aktion gesetzt', async () => {
    const onLockSession = vi.fn().mockResolvedValue(undefined)
    render(
      <TresorSessionBadge
        sessionLocked={false}
        hasKeys
        actions={{ onLockSession, onNavigateHomeWhenLocked: vi.fn() }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /API-Sitzung sperren/i }))
    expect(onLockSession).toHaveBeenCalledTimes(1)
  })
})

describe('ChatViewChatHeader (§ H.1a)', () => {
  it('zeigt Kanal-Titel und Umschalter Privat/Gruppe', () => {
    const onChannelModeChange = vi.fn()
    render(
      <ChatViewChatHeader
        {...baseHeader({
          channelMode: 'private',
          onChannelModeChange,
        })}
      />
    )
    expect(screen.getByRole('heading', { name: /1:1 Privat/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Gruppe$/i }))
    expect(onChannelModeChange).toHaveBeenCalledWith('group')
  })

  it('zeigt Pinnwand-Ungelesen-Badge am Tab', () => {
    const pinnwandAddr = `0x${'c'.repeat(64)}`
    render(
      <ChatViewChatHeader
        {...baseHeader({
          channelMode: 'private',
          onChannelModeChange: vi.fn(),
          pinnwandTabUnreadCount: 4,
          apiStatus: {
            ...TEST_API_STATUS_SEND_READY,
            broadcastPinnwand: { enabled: true, address: pinnwandAddr },
          },
        })}
      />
    )
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('warnt bei unsicherer Geräte-Uhr (§ H.6c)', () => {
    render(<ChatViewChatHeader {...baseHeader({ deviceTimeTrustWarn: true })} />)
    expect(screen.getByText(/Geräte-Uhr:/)).toBeInTheDocument()
  })

  it('zeigt Offline-Cache-Banner bei fromCache', () => {
    render(
      <ChatViewChatHeader
        {...baseHeader({
          apiStatus: { ...TEST_API_STATUS_SEND_READY, fromCache: true },
          statusCacheAgeMinutes: 12,
        })}
      />
    )
    expect(screen.getByText(/Offline \(Cache-Modus\)/)).toBeInTheDocument()
    expect(screen.getByText(/12 Min\./)).toBeInTheDocument()
  })

  it('zeigt Offline-Status-Streifen mit Queue', () => {
    render(
      <ChatViewChatHeader
        {...baseHeader({
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
    expect(screen.getByText(/Offline-Status:/)).toBeInTheDocument()
    expect(screen.getByText(/Queue: 2/)).toBeInTheDocument()
  })
})
