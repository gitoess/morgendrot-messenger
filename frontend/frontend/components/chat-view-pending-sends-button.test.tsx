import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChatViewPendingSendsButton } from '@/frontend/components/chat-view-pending-sends-button'

vi.mock('@/frontend/lib/tx-relay-queue', () => ({
  loadTxRelayQueue: vi.fn(() => []),
}))

vi.mock('@/frontend/lib/messenger-imperative-dialogs', () => ({
  openRelaySubmitDialog: vi.fn(),
}))

import { loadTxRelayQueue } from '@/frontend/lib/tx-relay-queue'

describe('ChatViewPendingSendsButton (§ H.1a)', () => {
  beforeEach(() => {
    vi.mocked(loadTxRelayQueue).mockReturnValue([])
  })

  it('shows Pending without count when queue empty', () => {
    render(<ChatViewPendingSendsButton offlineMailboxQueuePending={0} />)
    expect(screen.getByRole('button', { name: /^Pending$/i })).toBeInTheDocument()
  })

  it('shows Pending (n) for mailbox queue', () => {
    render(<ChatViewPendingSendsButton offlineMailboxQueuePending={3} />)
    expect(screen.getByRole('button', { name: /Pending \(3\)/i })).toBeInTheDocument()
  })

  it('dialog: nothing pending when empty', async () => {
    render(<ChatViewPendingSendsButton offlineMailboxQueuePending={0} />)
    fireEvent.click(screen.getByRole('button', { name: /^Pending$/i }))
    expect(await screen.findByText(/Nothing pending/i)).toBeInTheDocument()
  })

  it('Dialog: Mailbox-Einträge und Fehlerhinweis', async () => {
    render(
      <ChatViewPendingSendsButton
        offlineMailboxQueuePending={1}
        offlineMailboxQueueItems={[
          {
            id: 'q1',
            recipient: `0x${'a'.repeat(64)}`,
            createdAt: Date.UTC(2026, 5, 2, 12, 0, 0),
            attempts: 1,
            lastError: 'rpc timeout',
          },
        ]}
        offlineMailboxQueueErrorHint="Basis offline"
        onManualRefresh={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Pending \(1\)/i }))
    expect(await screen.findByText(/Mailbox \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/rpc timeout/)).toBeInTheDocument()
    expect(screen.getByText(/Basis offline/)).toBeInTheDocument()
  })

  it('calls onManualRefresh on Send now', async () => {
    const onManualRefresh = vi.fn(async () => {})
    render(
      <ChatViewPendingSendsButton
        offlineMailboxQueuePending={1}
        offlineMailboxQueueItems={[
          {
            id: 'q1',
            recipient: `0x${'a'.repeat(64)}`,
            createdAt: Date.now(),
            attempts: 0,
          },
        ]}
        onManualRefresh={onManualRefresh}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Pending \(1\)/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Send now/i }))
    await waitFor(() => expect(onManualRefresh).toHaveBeenCalledTimes(1))
  })

  it('removes selected queue entries', async () => {
    const onRemove = vi.fn()
    render(
      <ChatViewPendingSendsButton
        offlineMailboxQueuePending={1}
        offlineMailboxQueueItems={[
          {
            id: 'q-del',
            recipient: `0x${'b'.repeat(64)}`,
            createdAt: Date.now(),
            attempts: 2,
          },
        ]}
        onRemoveOfflineMailboxQueueItems={onRemove}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Pending \(1\)/i }))
    const checkbox = await screen.findByRole('checkbox')
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: /Remove \(1\)/i }))
    expect(onRemove).toHaveBeenCalledWith(['q-del'])
  })
})
