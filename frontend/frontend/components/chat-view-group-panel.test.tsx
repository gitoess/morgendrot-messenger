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
    expect(screen.getByRole('status')).toHaveTextContent(/Gruppe gespeichert \(1 Mitglied\)/)
    expect(screen.getByRole('button', { name: /Alpha Team \(1\)/i })).toBeInTheDocument()
  })

  it('zeigt Funk-Kanal im Tab Funk (nicht nur bei Sendepfad funk)', () => {
    render(<ChatViewGroupPanel contactDirectory={{}} />)
    expect(screen.queryByPlaceholderText(/Index 0-7/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /^Funk$/i }))
    expect(screen.getByPlaceholderText(/Index 0-7/i)).toBeInTheDocument()
  })

  it('Telegram-Tab verweist auf Einstellungen', () => {
    render(<ChatViewGroupPanel contactDirectory={{}} />)
    fireEvent.click(screen.getByRole('tab', { name: /^Telegram$/i }))
    expect(screen.getByText(/Einstellungen → Telegram/i)).toBeInTheDocument()
  })

  it('deaktiviert Enc bei funk', () => {
    render(
      <ChatViewGroupPanel contactDirectory={{}} forcedTransport="mesh" onEncryptedChange={vi.fn()} encrypted />
    )
    expect(screen.getByRole('button', { name: /Enc · Team-Schlüssel/i })).toBeDisabled()
  })

  it('warnt vor Klartext per Dialog', () => {
    const onEncryptedChange = vi.fn()
    render(
      <ChatViewGroupPanel contactDirectory={{}} encrypted onEncryptedChange={onEncryptedChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Klartext · Broadcast/i }))
    fireEvent.click(screen.getByRole('button', { name: /Verstanden, fortfahren/i }))
    expect(onEncryptedChange).toHaveBeenCalledWith(false)
  })

  it('hat Aus Telefonbuch neben Mitgliedern', () => {
    render(<ChatViewGroupPanel contactDirectory={{}} />)
    expect(screen.getByRole('button', { name: /Aus Telefonbuch/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Telefonbuch$/i })).not.toBeInTheDocument()
  })

  it('zeigt erkannte und unerkannte Mitglieder live', () => {
    const directory = {
      [MEMBER_A]: { label: 'Nicole', address: MEMBER_A },
    } as Record<string, { label: string; address: string }>
    render(<ChatViewGroupPanel contactDirectory={directory} />)
    fireEvent.change(document.querySelector('textarea')!, {
      target: { value: 'Nicole\nNikol' },
    })
    expect(screen.getByText(/1 Mitglied erkannt/i)).toBeInTheDocument()
    expect(screen.getByText(/Nicht erkannt: Nikol/i)).toBeInTheDocument()
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

  it('Pairwise: Annehmen nur für offene Peers, nicht für verbundene', () => {
    const id = createMessengerGroupId()
    upsertMessengerGroup({
      id,
      name: 'Pairwise',
      memberAddresses: [MEMBER_A, MEMBER_B],
      useTeamBroadcast: false,
    })
    writeActiveGroupId(id)
    render(
      <ChatViewGroupPanel
        contactDirectory={{}}
        encrypted
        forcedTransport="internet"
        handshake={{
          sending: false,
          connectedAddresses: [MEMBER_A],
          onHandshakeForAddress: vi.fn(),
          onConnectAcceptForAddress: vi.fn(),
        }}
      />
    )
    expect(screen.getByText(/^verbunden$/i)).toBeInTheDocument()
    expect(screen.getByText(/^offen$/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Annehmen$/i })).toHaveLength(1)
  })
})
