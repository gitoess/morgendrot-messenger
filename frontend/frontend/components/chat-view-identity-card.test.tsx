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

  it('shows full card with copy button', () => {
    render(<ChatViewIdentityCard myAddressLine={MY_ADDR} />)
    expect(screen.getByText(/My IOTA address/)).toBeInTheDocument()
    expect(screen.getByText(MY_ADDR)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Copy address/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MY_ADDR)
  })

  it('shows compact variant', () => {
    render(<ChatViewIdentityCard myAddressLine={MY_ADDR} compact />)
    expect(screen.getByText(/Your contact ID:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Copy$/i })).toBeInTheDocument()
  })
})
