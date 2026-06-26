import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EinsatzleitungTeamRosterPanel } from '@/frontend/components/einsatzleitung-team-roster-panel'

vi.mock('@/frontend/lib/team-roster-wire', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/frontend/lib/team-roster-wire')>()
  return {
    ...actual,
    removeTeamMemberFromRoster: vi.fn(async () => ({ ok: true, channels: { iota: true } })),
  }
})

vi.mock('@/frontend/lib/team-removed-members-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/frontend/lib/team-removed-members-store')>()
  return {
    ...actual,
    markTeamMemberRemoveSent: vi.fn((...args: Parameters<typeof actual.markTeamMemberRemoveSent>) =>
      actual.markTeamMemberRemoveSent(...args)
    ),
  }
})

import { removeTeamMemberFromRoster } from '@/frontend/lib/team-roster-wire'

const BOSS = `0x${'b'.repeat(64)}`
const HELPER = `0x${'c'.repeat(64)}`
const TEAM_MB = `0x${'a'.repeat(64)}`

describe('EinsatzleitungTeamRosterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', () => true)
  })

  it('zeigt Helfer mit Entfernen-Button', () => {
    render(
      <EinsatzleitungTeamRosterPanel
        apiStatus={{
          myAddressFull: BOSS,
          mailboxId: TEAM_MB,
          handoffLabel: 'team-1',
          role: 'boss',
        } as never}
        contactDirectory={{ [HELPER]: { label: 'Nicole' } }}
      />
    )
    expect(screen.getByText(/Team-Telefonbuch/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aus Team entfernen/i })).toBeInTheDocument()
  })

  it('ruft removeTeamMemberFromRoster auf und zeigt Entfernt', async () => {
    render(
      <EinsatzleitungTeamRosterPanel
        apiStatus={{
          myAddressFull: BOSS,
          mailboxId: TEAM_MB,
          role: 'kommandant',
        } as never}
        contactDirectory={{ [HELPER]: { label: 'Max' } }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Aus Team entfernen/i }))
    await waitFor(() => {
      expect(removeTeamMemberFromRoster).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByText(/Entfernt/i)).toBeInTheDocument()
    })
  })
})
