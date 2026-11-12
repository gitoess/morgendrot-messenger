import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewContactDetailDialog } from '@/frontend/components/chat-view-contact-detail-dialog'

vi.mock('@/frontend/components/contact-phonebook-card', () => ({
  ContactPhonebookCard: () => <div data-testid="phonebook-card" />,
}))

const WALLET = `0x${'cd'.repeat(32)}`
const MB = `0x${'ab'.repeat(32)}`

describe('ChatViewContactDetailDialog Technische IDs', () => {
  it('zeigt Mailbox-Zeile wenn Slot gesetzt', () => {
    render(
      <ChatViewContactDetailDialog
        open
        onOpenChange={() => undefined}
        address={WALLET}
        entry={{
          label: 'Ada',
          mailboxPrivateId: MB,
        }}
        directory={{ [WALLET]: { label: 'Ada', mailboxPrivateId: MB } }}
        messages={[]}
        myAddress={`0x${'11'.repeat(32)}`}
        isFavorite={false}
        onToggleFavorite={() => undefined}
        onEdit={() => undefined}
        onShowQr={() => undefined}
        onRemove={() => undefined}
      />
    )
    expect(screen.getByText('Mailboxen')).toBeInTheDocument()
    expect(screen.getByText('Privat')).toBeInTheDocument()
    expect(screen.getByText(MB)).toBeInTheDocument()
  })
})
