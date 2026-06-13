import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewInboxHandshakeRequests } from '@/frontend/components/chat-view-inbox-handshake-requests'

describe('ChatViewInboxHandshakeRequests', () => {
  it('rendert eingehende Anfragen mit Annehmen und Löschen', () => {
    render(
      <ChatViewInboxHandshakeRequests
        offers={[
          { sender: '0x' + 'a'.repeat(64), nonce: '1', source: 'event' },
          { sender: '0x' + 'b'.repeat(64), nonce: '2', source: 'mailbox' },
        ]}
        directory={{}}
        onAccept={vi.fn()}
        onUseAsPartner={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText(/Handshake-Anfragen \(eingehend\)/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Annehmen/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Löschen/i })).toHaveLength(2)
  })

  it('blendet sich aus ohne Angebote', () => {
    const { container } = render(
      <ChatViewInboxHandshakeRequests offers={[]} directory={{}} onAccept={vi.fn()} onUseAsPartner={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })
})
