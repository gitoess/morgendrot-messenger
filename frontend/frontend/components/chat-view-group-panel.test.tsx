import { createRef } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewGroupPanel } from '@/frontend/components/chat-view-group-panel'
import {
  createMessengerGroupId,
  upsertMessengerGroup,
  writeActiveGroupId,
} from '@/frontend/lib/messenger-group-store'

vi.mock('@/frontend/components/contact-phonebook-picker-dialog', () => ({
  ContactPhonebookPickerDialog: () => null,
}))
vi.mock('@/frontend/lib/create-team-mailbox-on-chain', () => ({
  createTeamMailboxOnChain: vi.fn(),
}))

const MEMBER_A = `0x${'a'.repeat(64)}`
const MEMBER_B = `0x${'b'.repeat(64)}`

describe('ChatViewGroupPanel (§ H.1a)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('zeigt Gruppen-Überschrift', () => {
    render(<ChatViewGroupPanel contactDirectory={{}} />)
    expect(screen.getByRole('heading', { name: /^Gruppe$/i })).toBeInTheDocument()
  })

  it('speichert Gruppe mit gültigen Mitgliedern', () => {
    render(<ChatViewGroupPanel contactDirectory={{}} onEncryptedChange={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Einsatz Alpha/i), {
      target: { value: 'Alpha Team' },
    })
    fireEvent.change(document.querySelector('textarea')!, { target: { value: MEMBER_A } })
    fireEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))
    expect(screen.getByText(/Gruppe gespeichert/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Alpha Team \(1\)/i })).toBeInTheDocument()
  })

  it('zeigt Meshtastic Secondary bei Sendepfad funk', () => {
    render(<ChatViewGroupPanel contactDirectory={{}} forcedTransport="mesh" />)
    expect(screen.getByPlaceholderText(/Index 0-7/i)).toBeInTheDocument()
  })

  it('deaktiviert Verschlüsselt bei funk', () => {
    render(
      <ChatViewGroupPanel contactDirectory={{}} forcedTransport="mesh" onEncryptedChange={vi.fn()} encrypted />
    )
    expect(screen.getByRole('button', { name: /^Verschlüsselt$/i })).toBeDisabled()
  })

  it('warnt vor Klartext per Dialog', () => {
    const onEncryptedChange = vi.fn()
    render(
      <ChatViewGroupPanel contactDirectory={{}} encrypted onEncryptedChange={onEncryptedChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: /^Unverschlüsselt$/i }))
    fireEvent.click(screen.getByRole('button', { name: /Verstanden, fortfahren/i }))
    expect(onEncryptedChange).toHaveBeenCalledWith(false)
  })

  it('blockiert Neue Gruppe ohne Berechtigung', () => {
    render(<ChatViewGroupPanel contactDirectory={{}} groupCreateAllowed={false} />)
    expect(screen.getByRole('button', { name: /Neue Gruppe/i })).toBeDisabled()
  })

  it('wechselt zwischen gespeicherten Gruppen', () => {
    const id1 = createMessengerGroupId()
    const id2 = createMessengerGroupId()
    upsertMessengerGroup({ id: id1, name: 'Einsatz 1', memberAddresses: [MEMBER_A] })
    upsertMessengerGroup({ id: id2, name: 'Einsatz 2', memberAddresses: [MEMBER_B] })
    writeActiveGroupId(id1)

    render(<ChatViewGroupPanel contactDirectory={{}} />)
    fireEvent.click(screen.getByRole('button', { name: /Einsatz 2 \(1\)/i }))
    expect(screen.getByDisplayValue('Einsatz 2')).toBeInTheDocument()
  })
})
