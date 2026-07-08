import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewPhonebookSection } from '@/frontend/components/chat-view-phonebook-section'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'

vi.mock('@/frontend/components/phonebook-mesh-backup-panel', () => ({
  PhonebookMeshBackupPanel: () => null,
}))
vi.mock('@/frontend/components/phonebook-contact-distribute-panel', () => ({
  PhonebookContactDistributePanel: () => null,
}))

const WALLET_A = `0x${'a'.repeat(64)}`
const WALLET_B = `0x${'b'.repeat(64)}`

function baseProps(over: Partial<Parameters<typeof ChatViewPhonebookSection>[0]> = {}) {
  return {
    directory: {} as Record<string, ContactMeshEntryClient>,
    refreshContactDirectory: vi.fn(),
    setStatusMsg: vi.fn(),
    ...over,
  }
}

describe('ChatViewPhonebookSection (§ H.1a)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('zeigt Titel und Neuer-Kontakt-Button', () => {
    render(<ChatViewPhonebookSection {...baseProps()} />)
    expect(screen.getByRole('heading', { name: /Telefonbuch/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Neuer Kontakt/i })).toBeInTheDocument()
  })

  it('listet Kontakte und zählt sichtbare Einträge', () => {
    const directory: Record<string, ContactMeshEntryClient> = {
      [WALLET_A]: { label: 'Alpha', meshNodeId: 'node-1' },
      [WALLET_B]: { label: 'Bravo' },
    }
    render(<ChatViewPhonebookSection {...baseProps({ directory })} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Bravo')).toBeInTheDocument()
    expect(screen.getByText(/2 Kontakte gespeichert/)).toBeInTheDocument()
  })

  it('filtert per Suche', () => {
    const directory: Record<string, ContactMeshEntryClient> = {
      [WALLET_A]: { label: 'Alpha' },
      [WALLET_B]: { label: 'Bravo' },
    }
    render(<ChatViewPhonebookSection {...baseProps({ directory })} />)
    fireEvent.change(screen.getByPlaceholderText(/Name, Adresse oder Meshtastic/i), {
      target: { value: 'Alpha' },
    })
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Bravo')).not.toBeInTheDocument()
  })

  it('filtert LoRa-Kontakte', () => {
    const directory: Record<string, ContactMeshEntryClient> = {
      [WALLET_A]: { label: 'Funk', meshNodeId: 'abc' },
      [WALLET_B]: { label: 'Nur Online' },
    }
    render(
      <ChatViewPhonebookSection
        {...baseProps({ directory, connectedAddresses: [WALLET_B] })}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /LoRa/i }))
    expect(screen.getByText('Funk')).toBeInTheDocument()
    expect(screen.queryByText('Nur Online')).not.toBeInTheDocument()
  })

  it('öffnet Einstellungen-Link für Mailboxen', () => {
    const onOpenSettings = vi.fn()
    render(
      <ChatViewPhonebookSection
        {...baseProps({
          myAddressLine: WALLET_A,
          onOpenSettings,
        })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Einstellungen.*Meine Mailboxen/i }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })
})
