import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewChainPersistenceBadge } from '@/frontend/components/chat-view-chain-persistence-badge'

describe('ChatViewChainPersistenceBadge (§ H.1a)', () => {
  it('zeigt Event-Pfad bei mode event', () => {
    render(<ChatViewChainPersistenceBadge mode="event" encrypted={false} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/Klartext · Event/)
    expect(status).toHaveTextContent(/send_plaintext_message/)
  })

  it('zeigt Mailbox-Pfad bei mode mailbox', () => {
    render(<ChatViewChainPersistenceBadge mode="mailbox" encrypted />)
    expect(screen.getByRole('status')).toHaveTextContent(/Verschlüsselt · Mailbox/)
  })

  it('nutzt violet-Styling für Mailbox', () => {
    const { container } = render(<ChatViewChainPersistenceBadge mode="mailbox" encrypted={false} />)
    expect(container.querySelector('.border-violet-500\\/35')).toBeTruthy()
  })

  it('nutzt sky-Styling für Event', () => {
    const { container } = render(<ChatViewChainPersistenceBadge mode="event" encrypted />)
    expect(container.querySelector('.border-sky-500\\/35')).toBeTruthy()
  })
})
