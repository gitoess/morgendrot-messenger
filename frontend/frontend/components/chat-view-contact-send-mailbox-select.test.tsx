import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewContactSendMailboxSelect } from '@/frontend/components/chat-view-contact-send-mailbox-select'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'

const RECIPIENT = `0x${'a'.repeat(64)}`
const PRIVATE_MB = `0x${'b'.repeat(64)}`
const SERVER_MB = `0x${'d'.repeat(64)}`

const entry: ContactMeshEntryClient = {
  label: 'Partner',
  mailboxPrivateId: PRIVATE_MB,
}

describe('ChatViewContactSendMailboxSelect (§ H.1a)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('rendert nichts bei ungültiger Wallet', () => {
    const { container } = render(
      <ChatViewContactSendMailboxSelect recipientWallet="kurz" contactDirectory={{}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('zeigt Event-Hinweis bei Standard-Ziel', () => {
    render(
      <ChatViewContactSendMailboxSelect
        recipientWallet={RECIPIENT}
        contactDirectory={{ [RECIPIENT]: entry }}
      />
    )
    expect(screen.getByText(/Speicher auf der Chain/i)).toBeInTheDocument()
    expect(screen.getByText(/Flüchtig — schneller Event/)).toBeInTheDocument()
  })

  it('ruft onTargetChange bei Slot-Wechsel auf', () => {
    const onTargetChange = vi.fn()
    render(
      <ChatViewContactSendMailboxSelect
        recipientWallet={RECIPIENT}
        contactDirectory={{ [RECIPIENT]: entry }}
        serverMailboxId={SERVER_MB}
        onTargetChange={onTargetChange}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'private' } })
    expect(onTargetChange).toHaveBeenCalled()
    expect(onTargetChange.mock.calls[0]?.[0]).toBe('private')
    expect(String(onTargetChange.mock.calls[0]?.[1])).toMatch(/^0x/)
  })

  it('zeigt Postfach-Zeile wenn Privat-Slot gewählt', () => {
    window.localStorage.setItem(
      'morgendrot.contactSendMailboxSlot.v1',
      JSON.stringify({ [RECIPIENT]: 'private' })
    )
    render(
      <ChatViewContactSendMailboxSelect
        recipientWallet={RECIPIENT}
        contactDirectory={{ [RECIPIENT]: entry }}
        serverMailboxId={SERVER_MB}
      />
    )
    expect(screen.getByText(/Postfach:/)).toBeInTheDocument()
  })
})
