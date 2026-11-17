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

function openContactMenu() {
  const btn = screen.getByRole('button', { name: 'Kontakt-Menü' })
  fireEvent.pointerDown(btn, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(btn)
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

  it('legt Team-Entfernen ins Menü, nicht auf die Karte', () => {
    const onRemove = vi.fn()
    render(<ContactPhonebookCard {...baseProps} onRemoveFromTeam={onRemove} />)
    expect(screen.queryByRole('button', { name: /Aus Einsatz-Team nehmen/i })).toBeNull()
    openContactMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /Aus Einsatz-Team nehmen/i }))
    expect(onRemove).toHaveBeenCalled()
  })

  it('zeigt Entfernt-Hinweis im Menü nach teamRemoveSent', () => {
    render(<ContactPhonebookCard {...baseProps} teamRemoveSent />)
    openContactMenu()
    expect(screen.getByText(/Aus Team entfernt/i)).toBeInTheDocument()
  })
})
