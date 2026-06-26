import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { InboxTeamSyncSystemCards } from '@/frontend/components/inbox-team-sync-system-cards'
import { buildMorgTeamMemberUpdateV1Marker } from '@/frontend/lib/morg-team-member-update-v1'
import type { Message } from '@/frontend/lib/types'

vi.mock('@/frontend/lib/api/contacts', () => ({
  applyInitialProfileProvisioning: vi.fn(async () => ({ ok: true, applied: 1 })),
}))

vi.mock('@/frontend/lib/contact-phonebook-meta-store', () => ({
  hideContactFromPhonebook: vi.fn(),
}))

import { hideContactFromPhonebook } from '@/frontend/lib/contact-phonebook-meta-store'
import { markTeamUpdateSeqApplied } from '@/frontend/lib/team-update-inbox-state'

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
  return { id: `m-${seq}`, content: body, sender: BOSS, timestamp: Date.now() } as Message
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

  it('blendet Remove-Karte nach Bestätigung aus ohne Telefonbuch zu ändern', () => {
    const msg = msgWithTeamUpdate('remove', 2)
    const { rerender } = render(<InboxTeamSyncSystemCards messages={[msg]} />)
    expect(screen.getByText(/Mitglied aus Team entfernt/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Entfernung bestätigen/i }))
    expect(hideContactFromPhonebook).not.toHaveBeenCalled()
    markTeamUpdateSeqApplied(2)
    rerender(<InboxTeamSyncSystemCards messages={[msg]} />)
    expect(screen.queryByText(/Mitglied aus Team entfernt/i)).not.toBeInTheDocument()
  })

  it('blendet optional aus dem Telefonbuch aus', () => {
    render(<InboxTeamSyncSystemCards messages={[msgWithTeamUpdate('remove', 3)]} />)
    fireEvent.click(screen.getByLabelText(/Auch aus meinem Telefonbuch ausblenden/i))
    fireEvent.click(screen.getByRole('button', { name: /Entfernung bestätigen/i }))
    expect(hideContactFromPhonebook).toHaveBeenCalledWith(MEMBER)
  })
})
