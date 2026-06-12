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
})
