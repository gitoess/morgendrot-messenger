import { describe, expect, it, vi } from 'vitest'
import {
  contactToTeamMember,
  listTeamRosterWalletContacts,
  resolveTeamSyncContext,
} from './team-roster-wire'

const BOSS = `0x${'b'.repeat(64)}`
const HELPER = `0x${'c'.repeat(64)}`
const TEAM_MB = `0x${'a'.repeat(64)}`

describe('team-roster-wire', () => {
  it('resolveTeamSyncContext liefert boss, teamMb, teamId', () => {
    const ctx = resolveTeamSyncContext({
      myAddressFull: BOSS,
      inboxUnionMailboxIds: [TEAM_MB],
      handoffLabel: 'Alpha',
      role: 'boss',
    } as never)
    expect(ctx).toEqual({ boss: BOSS, teamMb: TEAM_MB, teamId: 'Alpha' })
  })

  it('listTeamRosterWalletContacts schließt Boss aus', () => {
    const list = listTeamRosterWalletContacts(
      {
        [BOSS]: { label: 'Boss' },
        [HELPER]: { label: 'Nicole', roleTags: ['Medic'] },
      },
      BOSS
    )
    expect(list).toHaveLength(1)
    expect(list[0]?.address).toBe(HELPER)
  })

  it('contactToTeamMember übernimmt roleTags und meshNodeId', () => {
    const m = contactToTeamMember(
      { [HELPER]: { label: 'Nicole', roleTags: ['Medic'], meshNodeId: '!abc' } },
      HELPER
    )
    expect(m?.name).toBe('Nicole')
    expect(m?.roleTags).toEqual(['Medic'])
    expect(m?.meshNodeId).toBe('!abc')
  })
})

describe('removeTeamMemberFromRoster', () => {
  it('bricht ab wenn Nutzer cancelt', async () => {
    vi.resetModules()
    vi.doMock('@/frontend/lib/team-sync-wire', () => ({
      publishTeamMemberUpdateWire: vi.fn(),
    }))
    const { removeTeamMemberFromRoster } = await import('./team-roster-wire')
    const r = await removeTeamMemberFromRoster({
      apiStatus: {
        myAddressFull: BOSS,
        mailboxId: TEAM_MB,
        handoffLabel: 't',
        role: 'boss',
      } as never,
      member: { address: HELPER, name: 'Nicole' },
      confirm: () => false,
    })
    expect(r.ok).toBe(false)
    expect(r.cancelled).toBe(true)
  })
})
