import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewPinnwandFeedPanel } from '@/frontend/components/chat-view-pinnwand-feed-panel'
import type { Message } from '@/frontend/lib/types'

vi.mock('@/frontend/components/chat-view-inbox-list', () => ({
  ChatViewInboxList: () => <div data-testid="inbox-list-mock">Inbox</div>,
}))
vi.mock('@/frontend/components/chat-view-pinnwand-moderation-card', () => ({
  ChatViewPinnwandModerationCard: () => <div data-testid="moderation-card">Mod</div>,
}))
vi.mock('@/frontend/components/chat-view-pinnwand-reader-banner', () => ({
  ChatViewPinnwandReaderBanner: ({ unreadCount }: { unreadCount: number }) => (
    <div data-testid="reader-banner">{unreadCount} neu</div>
  ),
}))

const msg = (id: string): Message => ({ id, content: 'pin', from: '0x', timestamp: 1 })

function baseListProps() {
  return {
    loadError: null as string | null,
    inboxFromCache: false,
    inboxCacheAgeMinutes: null as number | null,
    basisUnreachable: false,
    messages: [] as Message[],
    inboxRows: [],
    myAddress: '',
    contactDirectory: {},
    isMeshVerifiedForAddress: () => false,
    exportEcdhMorgPkgForMessage: vi.fn(),
    onHideInboxMessageLocal: vi.fn(),
    onPurgeInboxMessageChain: vi.fn(),
    onForwardMessage: vi.fn(),
    onReplyToMessage: vi.fn(),
    toggleProtokollMark: vi.fn(),
    protokollMarkedIds: new Set<string>(),
    pinnedPinnwandIds: new Set<string>(),
    onTogglePinnedPinnwand: vi.fn(),
    showPinnwandPinActions: false,
    inboxSelectMode: false,
    selectedInboxIds: new Set<string>(),
    toggleInboxSelection: vi.fn(),
    onDismissMeshInboundBanner: vi.fn(),
    loadingMore: false,
    loadMoreInbox: vi.fn(),
    inboxHasMore: false,
    onAddSenderToContactBook: vi.fn(),
    onSarqNakWire: vi.fn(),
    isInboxMessageUnread: () => false,
    isPinnwandInboxMessage: () => false,
    sending: false,
  }
}

describe('ChatViewPinnwandFeedPanel (§ H.1a)', () => {
  it('zeigt leeren Feed mit Reader-Banner', () => {
    render(
      <ChatViewPinnwandFeedPanel
        {...baseListProps()}
        canPost={false}
        unreadCount={3}
        isPinnwandInboxMessage={() => false}
      />
    )
    expect(screen.getByTestId('reader-banner')).toHaveTextContent('3 neu')
    expect(screen.getByText(/Noch keine Pinnwand-Meldungen/i)).toBeInTheDocument()
  })

  it('zeigt Moderation-Karte bei canPost', () => {
    render(
      <ChatViewPinnwandFeedPanel
        {...baseListProps()}
        canPost
        isPinnwandInboxMessage={() => false}
      />
    )
    expect(screen.getByTestId('moderation-card')).toBeInTheDocument()
    expect(screen.getByText(/Unten eine Nachricht verfassen/i)).toBeInTheDocument()
  })

  it('rendert Inbox-Liste wenn Zeilen vorhanden', () => {
    render(
      <ChatViewPinnwandFeedPanel
        {...baseListProps()}
        inboxRows={[{ kind: 'msg', msg: msg('p1'), sortTs: 1 }]}
        messages={[msg('p1')]}
        isPinnwandInboxMessage={(m) => m.id === 'p1'}
      />
    )
    expect(screen.getByTestId('inbox-list-mock')).toBeInTheDocument()
  })

  it('ruft onRefresh auf', () => {
    const onRefresh = vi.fn()
    render(
      <ChatViewPinnwandFeedPanel
        {...baseListProps()}
        onRefresh={onRefresh}
        isPinnwandInboxMessage={() => false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Aktualisieren/i }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
