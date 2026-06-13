import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewEncryptionContextHint } from '@/frontend/components/chat-view-encryption-context-hint'

describe('ChatViewEncryptionContextHint (§ H.1a)', () => {
  it('rendert nichts wenn kein Hinweis', () => {
    const { container } = render(
      <ChatViewEncryptionContextHint forcedTransport="mesh" encrypted={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('zeigt Funk-Schloss-Warnung', () => {
    render(<ChatViewEncryptionContextHint forcedTransport="mesh" encrypted />)
    expect(screen.getByRole('note')).toHaveTextContent(/Schloss/)
  })

  it('zeigt Online-Klartext-Hinweis', () => {
    render(<ChatViewEncryptionContextHint forcedTransport="internet" encrypted={false} />)
    expect(screen.getByRole('note')).toHaveTextContent(/Klartext/)
  })

  it('nutzt compact-Variante ohne Rahmen-Klassen', () => {
    render(
      <ChatViewEncryptionContextHint forcedTransport="internet" encrypted compact className="test-hint" />
    )
    const note = screen.getByRole('note')
    expect(note).toHaveClass('test-hint')
    expect(note.className).not.toMatch(/rounded-md border/)
  })
})
