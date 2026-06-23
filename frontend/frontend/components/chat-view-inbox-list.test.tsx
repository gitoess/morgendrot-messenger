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

describe('ChatViewInboxList reply action', () => {
  it('shows Antworten button when onReplyToMessage is provided', () => {
    const onReplyToMessage = vi.fn()
    render(<ChatViewInboxList {...makeProps({ onReplyToMessage })} />)
    const btn = screen.getByRole('button', { name: /Antworten/i })
    expect(btn).toBeInTheDocument()
    btn.click()
    expect(onReplyToMessage).toHaveBeenCalledTimes(1)
  })

  it('hides Antworten without onReplyToMessage (§ H.1a)', () => {
    render(<ChatViewInboxList {...makeProps()} />)
    expect(screen.queryByRole('button', { name: /Antworten/i })).not.toBeInTheDocument()
  })

  it('disables Antworten while sending (§ H.1a)', () => {
    const onReplyToMessage = vi.fn()
    render(<ChatViewInboxList {...makeProps({ onReplyToMessage, sending: true })} />)
    const btn = screen.getByRole('button', { name: /Antworten/i })
    expect(btn).toBeDisabled()
  })

  it('shows Eingang badge for incoming message (§ H.1a)', () => {
    render(<ChatViewInboxList {...makeProps()} />)
    expect(screen.getByText('Eingang')).toBeInTheDocument()
    expect(screen.queryByText('Ausgang')).not.toBeInTheDocument()
  })

  it('shows visibility hint when inbox empty (§ H.1a)', () => {
    render(
      <ChatViewInboxList
        {...makeProps({
          inboxRows: [],
          inboxVisibilityHint: 'Nur Partner „Hans“ sichtbar.',
        })}
      />
    )
    expect(screen.getByText('Nur Partner „Hans“ sichtbar.')).toBeInTheDocument()
  })

  it('shows offline cache banner when inboxFromCache and empty (§ H.1a)', () => {
    render(
      <ChatViewInboxList
        {...makeProps({
          inboxRows: [],
          inboxFromCache: true,
          inboxCacheAgeMinutes: 12,
          inboxLiveSource: 'rpc',
        })}
      />
    )
    expect(screen.getByText(/Morgendrot-Basis nicht erreichbar/)).toBeInTheDocument()
    expect(screen.getByText(/zuletzt per Direkt-RPC/)).toBeInTheDocument()
  })
})
