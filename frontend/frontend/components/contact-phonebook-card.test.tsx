import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ContactPhonebookCard } from '@/frontend/components/contact-phonebook-card'

const ADDR = `0x${'a'.repeat(64)}`

const baseProps = {
  address: ADDR,
  entry: { label: 'Nicole', roleTags: ['Medic', 'THW'] },
  displayName: 'Nicole',
  isFavorite: false,
  isOnline: true,
  hasLora: false,
  hasPrivateMailbox: false,
  loraOnly: false,
  expanded: false,
  onToggleExpand: vi.fn(),
  onToggleFavorite: vi.fn(),
  onEdit: vi.fn(),
  onShowQr: vi.fn(),
  onRemove: vi.fn(),
  onRecordContact: vi.fn(),
}

describe('ContactPhonebookCard', () => {
  it('zeigt Rollen-Tags und Team-Badge', () => {
    render(
      <ContactPhonebookCard
        {...baseProps}
        onRemoveFromTeam={vi.fn()}
      />
    )
    expect(screen.getByText('Medic')).toBeInTheDocument()
    expect(screen.getByText('THW')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
  })

  it('zeigt sichtbaren Aus-Team-entfernen-Button', () => {
    const onRemove = vi.fn()
    render(<ContactPhonebookCard {...baseProps} onRemoveFromTeam={onRemove} />)
    const btn = screen.getByRole('button', { name: /Aus Team entfernen/i })
    fireEvent.click(btn)
    expect(onRemove).toHaveBeenCalled()
  })

  it('zeigt Entfernt-Hinweis nach teamRemoveSent', () => {
    render(<ContactPhonebookCard {...baseProps} teamRemoveSent />)
    expect(screen.getByText(/Aus Team entfernt/i)).toBeInTheDocument()
  })
})
