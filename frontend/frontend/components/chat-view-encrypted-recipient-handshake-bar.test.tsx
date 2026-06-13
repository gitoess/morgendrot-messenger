import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewEncryptedRecipientHandshakeBar } from '@/frontend/components/chat-view-encrypted-recipient-handshake-bar'

describe('ChatViewEncryptedRecipientHandshakeBar (§ H.1a)', () => {
  it('rendert nichts bei idle oder ready', () => {
    const { container: idle } = render(
      <ChatViewEncryptedRecipientHandshakeBar status="idle" />
    )
    expect(idle.firstChild).toBeNull()

    const { container: ready } = render(
      <ChatViewEncryptedRecipientHandshakeBar status="ready" />
    )
    expect(ready.firstChild).toBeNull()
  })

  it('zeigt Handshake senden bei needs_handshake', () => {
    const onHandshake = vi.fn()
    render(
      <ChatViewEncryptedRecipientHandshakeBar
        status="needs_handshake"
        onHandshake={onHandshake}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Handshake senden/)
    fireEvent.click(screen.getByRole('button', { name: /Handshake senden/i }))
    expect(onHandshake).toHaveBeenCalledTimes(1)
  })

  it('zeigt erneut senden bei awaiting_peer', () => {
    render(<ChatViewEncryptedRecipientHandshakeBar status="awaiting_peer" onHandshake={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Handshake erneut senden/i })).toBeInTheDocument()
  })

  it('zeigt Annehmen bei needs_accept', () => {
    const onAccept = vi.fn()
    render(
      <ChatViewEncryptedRecipientHandshakeBar
        status="needs_accept"
        onAccept={onAccept}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Handshake annehmen/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('deaktiviert Aktionen während sending', () => {
    render(
      <ChatViewEncryptedRecipientHandshakeBar
        status="needs_handshake"
        sending
        onHandshake={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Handshake senden/i })).toBeDisabled()
  })
})
