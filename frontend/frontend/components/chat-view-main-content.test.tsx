import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewMainContent, type ChatViewMainContentProps } from '@/frontend/components/chat-view-main-content'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'
import { testMessengerPorts } from '@/frontend/lib/test-fixtures/messenger-ports'
import type { ApiStatus } from '@/frontend/lib/api'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/frontend/hooks/use-messenger-client-expert-mode', () => ({
  useMessengerClientExpertMode: () => ({ enabled: false }),
}))

vi.mock('@/frontend/hooks/use-chat-view-pending-handshakes', () => ({
  useChatViewPendingHandshakes: () => ({
    offers: [],
    outgoingOffers: [],
    loading: false,
    reload: vi.fn(),
    dismissOffer: vi.fn(),
    dismissOutgoingOffer: vi.fn(),
  }),
}))

vi.mock('@/frontend/hooks/use-encrypted-recipient-handshake-status', () => ({
  useEncryptedRecipientHandshakeStatus: () => ({ status: 'idle', refresh: vi.fn() }),
}))

vi.mock('@/frontend/hooks/use-offline-status', () => ({
  useOfflineStatus: () => ({
    mode: 'online' as const,
    queuePending: 0,
    lastSuccessfulSyncMinutes: null,
  }),
}))

vi.mock('@/frontend/hooks/use-chat-view-telegram-composer', () => ({
  useChatViewTelegramComposer: () => ({}),
}))

vi.mock('@/frontend/components/chat-view-inbox-panel', () => ({
  ChatViewInboxPanel: () => <div data-testid="inbox-panel" />,
}))

vi.mock('@/frontend/components/chat-view-send-panel', () => ({
  ChatViewSendPanel: () => <div data-testid="send-panel" />,
}))

vi.mock('@/frontend/components/chat-view-pinnwand-feed-panel', () => ({
  ChatViewPinnwandFeedPanel: () => <div data-testid="pinnwand-feed" />,
}))

vi.mock('@/frontend/components/chat-view-phonebook-sheet', () => ({
  ChatViewPhonebookSheet: () => null,
}))

vi.mock('@/frontend/components/lazy/messenger-scope-b', () => ({
  LazyChatViewRelaySubmitButton: () => null,
  LazyChatViewMorgPkgImportsSheet: () => null,
  LazyPeeringQrActions: () => null,
}))

const MY_ADDR = `0x${'a'.repeat(64)}`
const PINNWAND_ADDR = `0x${'c'.repeat(64)}`
const PACKAGE_ID = `0x${'f'.repeat(64)}`

const noop = vi.fn()
const asyncNoop = vi.fn(async () => {})

function buildMainContentProps(
  over: Partial<ChatViewMainContentProps> & {
    apiStatus?: ApiStatus | null
    packageIdMismatch?: boolean
    /** Legacy-Overrides — werden in `messengerPorts.shellRouting` gemerged. */
    isPrivate?: boolean
    isGroup?: boolean
    channelMode?: MessengerChatChannel
    activeGroup?: MessengerGroupDefinition | null
    role?: string
    myAddress?: string
  } = {}
): ChatViewMainContentProps {
  const {
    apiStatus: overApiStatus,
    packageIdMismatch: overPackageIdMismatch,
    messengerPorts: overPorts,
    isPrivate,
    isGroup,
    channelMode,
    activeGroup,
    role,
    myAddress,
    ...restOver
  } = over
  let messengerPorts =
    overPorts ??
    testMessengerPorts({
      myAddress: myAddress ?? MY_ADDR,
      forcedTransport: 'internet',
      encrypted: true,
      composerDelivery: 'chain',
      channelMode: channelMode ?? 'private',
      isGroup: isGroup ?? false,
      isPrivate: isPrivate ?? true,
      messagingPersistenceMode: 'event',
      partner: '',
      apiStatus: overApiStatus ?? TEST_API_STATUS_SEND_READY,
      packageIdMismatch: overPackageIdMismatch,
    })

  if (
    isPrivate !== undefined ||
    isGroup !== undefined ||
    channelMode !== undefined ||
    activeGroup !== undefined ||
    role !== undefined ||
    myAddress !== undefined
  ) {
    messengerPorts = {
      ...messengerPorts,
      shellRouting: {
        ...messengerPorts.shellRouting,
        ...(isPrivate !== undefined ? { isPrivate } : {}),
        ...(isGroup !== undefined ? { isGroup } : {}),
        ...(channelMode !== undefined ? { channelMode } : {}),
        ...(activeGroup !== undefined ? { activeGroup } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(myAddress !== undefined ? { myAddress } : {}),
      },
    }
  }

  return {
    messengerPorts,
    onChannelModeChange: noop,
    ...restOver,
  } as ChatViewMainContentProps
}

describe('ChatViewMainContent (§ H.1a)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('zeigt Privat-Composer und Posteingang', () => {
    render(<ChatViewMainContent {...buildMainContentProps()} />)
    expect(screen.getByRole('heading', { name: /^Alle Chats$/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Nachricht verfassen/i })).toBeInTheDocument()
    expect(screen.getByTestId('inbox-panel')).toBeInTheDocument()
    expect(screen.getByTestId('send-panel')).toBeInTheDocument()
  })

  it('zeigt Gruppen-Panel im Gruppenmodus', () => {
    render(
      <ChatViewMainContent
        {...buildMainContentProps({
          isPrivate: false,
          isGroup: true,
          channelMode: 'group',
          activeGroup: {
            id: 'g1',
            name: 'Team',
            memberAddresses: [MY_ADDR],
          },
        })}
      />
    )
    expect(screen.getByRole('heading', { name: /^Gruppenchat$/i })).toBeInTheDocument()
    expect(screen.queryByTestId('inbox-panel')).toBeInTheDocument()
  })

  it('zeigt Pinnwand-Composer auf Pinnwand-Tab', () => {
    render(
      <ChatViewMainContent
        {...buildMainContentProps({
          isPrivate: false,
          channelMode: 'pinnwand',
          messengerPorts: testMessengerPorts({
            isPrivate: false,
            channelMode: 'pinnwand',
            encrypted: false,
            apiStatus: {
              ...TEST_API_STATUS_SEND_READY,
              broadcastPinnwand: { enabled: true, address: PINNWAND_ADDR },
            },
          }),
          apiStatus: {
            ...TEST_API_STATUS_SEND_READY,
            broadcastPinnwand: { enabled: true, address: PINNWAND_ADDR },
          },
        })}
      />
    )
    expect(screen.getByRole('heading', { name: /^Pinnwand$/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Pinnwand/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('pinnwand-feed')).toBeInTheDocument()
  })

  it('zeigt Package-ID-Banner bei Mismatch', () => {
    render(
      <ChatViewMainContent
        {...buildMainContentProps({
          packageIdMismatch: true,
          apiStatus: {
            ...TEST_API_STATUS_SEND_READY,
            iotaTransportUiEnabled: true,
            packageId: PACKAGE_ID,
          },
        })}
      />
    )
    expect(screen.getByText(/Neue Protokoll-Version verfügbar/)).toBeInTheDocument()
  })

  it('zeigt Setup-Panel nur bei Funk-Sendepfad', () => {
    const { rerender } = render(<ChatViewMainContent {...buildMainContentProps()} />)
    expect(screen.queryByRole('button', { name: /Bluetooth verbinden/i })).not.toBeInTheDocument()

    rerender(
      <ChatViewMainContent
        {...buildMainContentProps({
          messengerPorts: testMessengerPorts({
            forcedTransport: 'mesh',
            encrypted: true,
            composerDelivery: 'chain',
            isPrivate: true,
            meshDevice: { bleSupported: true, transportKind: 'bluetooth' },
          }),
        })}
      />
    )
    expect(screen.getByRole('button', { name: /Bluetooth verbinden/i })).toBeInTheDocument()
  })
})
