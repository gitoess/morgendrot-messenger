import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatViewEncryptionModeToggle } from '@/frontend/components/chat-view-encryption-mode-toggle'

describe('ChatViewEncryptionModeToggle', () => {
  it('warnt vor Unverschlüsselt per Dialog', () => {
    const onEncryptedChange = vi.fn()
    render(
      <ChatViewEncryptionModeToggle
        encrypted
        forcedTransport="internet"
        onEncryptedChange={onEncryptedChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Unverschlüsselt/i }))
    expect(screen.getByText(/Unverschlüsselt senden/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Verstanden, fortfahren/i }))
    expect(onEncryptedChange).toHaveBeenCalledWith(false)
  })

  it('blendet Umschalter bei Funk aus', () => {
    const { container } = render(
      <ChatViewEncryptionModeToggle
        encrypted={false}
        forcedTransport="mesh"
        onEncryptedChange={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
