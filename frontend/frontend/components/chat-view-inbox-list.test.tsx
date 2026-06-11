import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewInboxList, type ChatViewInboxListProps } from '@/frontend/components/chat-view-inbox-list'

function makeProps(overrides: Partial<ChatViewInboxListProps> = {}): ChatViewInboxListProps {
  return {
    messages: [],
    myAddress: '0x' + '1'.repeat(64),
    loading: false,
    onRefresh: vi.fn(),
    loadError: null,
    basisUnreachable: false,
    inboxRows: [
      {
        kind: 'message',
        msg: {
          id: 'm1',
          from: '0x' + '2'.repeat(64),
          recipient: '0x' + '1'.repeat(64),
          timestamp: Date.now(),
          content: 'hi',
          source: 'inbox',
          encrypted: false,
          transports: ['internet'],
        },
      },
    ] as unknown as ChatViewInboxListProps['inboxRows'],
    contactDirectory: {},
    isMeshVerifiedForAddress: () => false,
    exportEcdhMorgPkgForMessage: vi.fn(),
    onHideInboxMessageLocal: vi.fn(),
    onPurgeInboxMessageChain: vi.fn(),
    onForwardMessage: vi.fn(),
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
    inboxVisibilityHint: null,
    ...overrides,
  } as unknown as ChatViewInboxListProps
}

describe('ChatViewInboxList handshake inline row', () => {
  it('renders inline pending handshakes with actions', () => {
    render(
      <ChatViewInboxList
        {...makeProps({
          pendingHandshakeOffers: [
            { sender: '0x' + 'a'.repeat(64), nonce: '1', source: 'mailbox' },
            { sender: '0x' + 'b'.repeat(64), nonce: '2', source: 'event' },
          ],
          onAcceptPendingHandshake: vi.fn(),
          onUseSenderAsPartnerFromInbox: vi.fn(),
        })}
      />
    )
    expect(screen.getByText(/Handshake-Anfragen \(eingehend\)/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Annehmen/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Als Partner/i })).toHaveLength(2)
  })

  it('shows Antworten button when onReplyToMessage is provided', () => {
    const onReplyToMessage = vi.fn()
    render(<ChatViewInboxList {...makeProps({ onReplyToMessage })} />)
    const btn = screen.getByRole('button', { name: /Antworten/i })
    expect(btn).toBeInTheDocument()
    btn.click()
    expect(onReplyToMessage).toHaveBeenCalledTimes(1)
  })

  it('shows overflow hint when more than three offers exist', () => {
    render(
      <ChatViewInboxList
        {...makeProps({
          pendingHandshakeOffers: [
            { sender: '0x' + 'a'.repeat(64), nonce: '1', source: 'mailbox' },
            { sender: '0x' + 'b'.repeat(64), nonce: '2', source: 'event' },
            { sender: '0x' + 'c'.repeat(64), nonce: '3', source: 'event' },
            { sender: '0x' + 'd'.repeat(64), nonce: '4', source: 'mailbox' },
          ],
          onAcceptPendingHandshake: vi.fn(),
        })}
      />
    )
    expect(screen.getByText(/\+1 weitere Anfrage\(n\) im Posteingang\./i)).toBeInTheDocument()
  })
})
