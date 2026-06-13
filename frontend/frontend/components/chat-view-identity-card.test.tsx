import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewIdentityCard } from '@/frontend/components/chat-view-identity-card'

const MY_ADDR = `0x${'e'.repeat(64)}`

describe('ChatViewIdentityCard (§ H.1a)', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rendert nichts bei ungültiger Adresse', () => {
    const { container } = render(<ChatViewIdentityCard myAddressLine="kurz" />)
    expect(container.firstChild).toBeNull()
  })

  it('zeigt volle Karte mit Kopieren-Button', () => {
    render(<ChatViewIdentityCard myAddressLine={MY_ADDR} />)
    expect(screen.getByText(/Meine IOTA-Adresse/)).toBeInTheDocument()
    expect(screen.getByText(MY_ADDR)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Adresse kopieren/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MY_ADDR)
  })

  it('zeigt kompakte Variante', () => {
    render(<ChatViewIdentityCard myAddressLine={MY_ADDR} compact />)
    expect(screen.getByText(/Deine Kontakt-ID:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kopieren/i })).toBeInTheDocument()
  })
})
