import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./team-sync-wire', () => ({
  publishTeamMemberUpdateWire: vi.fn(async () => ({ ok: true })),
}))

import {
  contactToTeamMember,
  listTeamRosterWalletContacts,
  publishTeamMemberAddWire,
  resolveTeamSyncContext,
} from './team-roster-wire'
import { publishTeamMemberUpdateWire } from './team-sync-wire'

const BOSS = `0x${'b'.repeat(64)}`
const HELPER = `0x${'c'.repeat(64)}`
const TEAM_MB = `0x${'a'.repeat(64)}`

describe('team-roster-wire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolveTeamSyncContext: signer = myAddress, boss aus bossAddress', () => {
    const ctx = resolveTeamSyncContext({
      bossAddress: BOSS,
      myAddressFull: HELPER,
      inboxUnionMailboxIds: [TEAM_MB],
      handoffLabel: 'Alpha',
      role: 'boss',
    } as never)
    expect(ctx).toEqual({ boss: BOSS, signer: HELPER, teamMb: TEAM_MB, teamId: 'Alpha' })
  })

  it('resolveTeamSyncContext liefert boss, signer, teamMb, teamId', () => {
    const ctx = resolveTeamSyncContext({
      myAddressFull: BOSS,
      inboxUnionMailboxIds: [TEAM_MB],
      handoffLabel: 'Alpha',
      role: 'boss',
    } as never)
    expect(ctx).toEqual({ boss: BOSS, signer: BOSS, teamMb: TEAM_MB, teamId: 'Alpha' })
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

  it('contactToTeamMember mappt Kontakt', () => {
    const m = contactToTeamMember({ [HELPER]: { label: 'Nicole', meshNodeId: '!abc' } }, HELPER)
    expect(m).toMatchObject({ address: HELPER, name: 'Nicole', meshNodeId: '!abc' })
  })

  it('publishTeamMemberAddWire nutzt signer für Wire-boss', async () => {
    const ctx = {
      boss: BOSS,
      signer: HELPER,
      teamMb: TEAM_MB,
      teamId: 'Alpha',
    }
    await publishTeamMemberAddWire(ctx, { address: HELPER, name: 'Nicole' })
    expect(publishTeamMemberUpdateWire).toHaveBeenCalledWith(
      expect.objectContaining({ bossAddress: HELPER })
    )
  })
})
