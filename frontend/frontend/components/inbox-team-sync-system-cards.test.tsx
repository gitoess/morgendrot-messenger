import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { InboxTeamSyncSystemCards } from '@/frontend/components/inbox-team-sync-system-cards'
import { buildMorgTeamMemberUpdateV1Marker } from '@/frontend/lib/morg-team-member-update-v1'
import type { Message } from '@/frontend/lib/types'

vi.mock('@/frontend/lib/api/contacts', () => ({
  applyInitialProfileProvisioning: vi.fn(async () => ({ ok: true, applied: 1 })),
}))

vi.mock('sonner', () => ({
  toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/frontend/lib/contact-phonebook-meta-store', () => ({
  hideContactFromPhonebook: vi.fn(),
}))

import { hideContactFromPhonebook } from '@/frontend/lib/contact-phonebook-meta-store'
import { applyInitialProfileProvisioning } from '@/frontend/lib/api/contacts'

const BOSS = `0x${'b'.repeat(64)}`
const MEMBER = `0x${'c'.repeat(64)}`

function msgWithTeamUpdate(kind: 'add' | 'remove', seq: number): Message {
  const body =
    kind === 'remove'
      ? buildMorgTeamMemberUpdateV1Marker({
          v: 1,
          kind: 'remove',
          seq,
          teamId: 'team-alpha',
          boss: BOSS,
          issuedAt: Date.now(),
          member: { address: MEMBER, name: 'Nicole' },
        })
      : buildMorgTeamMemberUpdateV1Marker({
          v: 1,
          kind: 'add',
          seq,
          teamId: 'team-alpha',
          boss: BOSS,
          issuedAt: Date.now(),
          member: { address: MEMBER, name: 'Nicole', meshNodeId: '!abc123' },
        })
  return { id: `m-${seq}`, from: BOSS, content: body, timestamp: Date.now() }
}

describe('InboxTeamSyncSystemCards', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('zeigt Add-Karte mit „Neues Team-Mitglied“', () => {
    render(<InboxTeamSyncSystemCards messages={[msgWithTeamUpdate('add', 1)]} />)
    expect(screen.getByText(/Neues Team-Mitglied/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Daten übernehmen/i })).toBeInTheDocument()
  })

  it('blendet Add-Karte nach „Daten übernehmen“ aus', async () => {
    const msg = msgWithTeamUpdate('add', 5)
    render(<InboxTeamSyncSystemCards messages={[msg]} />)
    expect(screen.getByText(/Neues Team-Mitglied/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Daten übernehmen/i }))
    await vi.waitFor(() => {
      expect(screen.queryByText(/Neues Team-Mitglied/i)).not.toBeInTheDocument()
    })
    expect(applyInitialProfileProvisioning).toHaveBeenCalled()
  })

  it('blendet Remove-Karte nach Bestätigung aus ohne Telefonbuch zu ändern', () => {
    const msg = msgWithTeamUpdate('remove', 2)
    render(<InboxTeamSyncSystemCards messages={[msg]} />)
    expect(screen.getByText(/Mitglied aus Team entfernt/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Entfernung bestätigen/i }))
    expect(hideContactFromPhonebook).not.toHaveBeenCalled()
    expect(screen.queryByText(/Mitglied aus Team entfernt/i)).not.toBeInTheDocument()
  })

  it('blendet optional aus dem Telefonbuch aus', () => {
    render(<InboxTeamSyncSystemCards messages={[msgWithTeamUpdate('remove', 3)]} />)
    fireEvent.click(screen.getByLabelText(/Auch aus meinem Telefonbuch ausblenden/i))
    fireEvent.click(screen.getByRole('button', { name: /Entfernung bestätigen/i }))
    expect(hideContactFromPhonebook).toHaveBeenCalledWith(MEMBER)
  })

  it('erkennt eigenes Team-Update — Verstanden ohne API', async () => {
    const msg = msgWithTeamUpdate('add', 4)
    render(<InboxTeamSyncSystemCards messages={[msg]} myAddress={MEMBER} />)
    expect(screen.getByText(/Das bist du/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Verstanden/i }))
    expect(applyInitialProfileProvisioning).not.toHaveBeenCalled()
  })

  it('zeigt „Empfangen über: LAN“ für LAN-Team-Update', () => {
    const body = buildMorgTeamMemberUpdateV1Marker({
      v: 1,
      kind: 'add',
      seq: 9,
      teamId: 'team-alpha',
      boss: BOSS,
      issuedAt: Date.now(),
      member: { address: MEMBER, name: 'Nicole', meshNodeId: '!abc123' },
    })
    const msg: Message = {
      id: 'lan-9',
      from: BOSS,
      content: body,
      timestamp: Date.now(),
      source: 'lan',
      transports: ['lan'],
    }
    render(<InboxTeamSyncSystemCards messages={[msg]} />)
    expect(screen.getByText(/Empfangen über: LAN/i)).toBeInTheDocument()
    expect(screen.getByText(/Von Einsatzleitung/i)).toBeInTheDocument()
  })
})
