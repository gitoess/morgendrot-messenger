import { describe, expect, it } from 'vitest'
import { buildMorgTeamMemberUpdateV1Marker } from '@/frontend/lib/morg-team-member-update-v1'
import { mapTeamSyncLanEntriesToMessages } from '@/frontend/lib/map-team-sync-lan-inbox-messages'

const BOSS = `0x${'b'.repeat(64)}`
const HELPER = `0x${'h'.repeat(64)}`

describe('mapTeamSyncLanEntriesToMessages', () => {
  it('mappt LAN-Einträge mit source=lan und Boss aus Wire', () => {
    const wire = buildMorgTeamMemberUpdateV1Marker({
      v: 1,
      kind: 'add',
      seq: 7,
      teamId: 'alpha',
      boss: BOSS,
      issuedAt: Date.now(),
      member: { address: HELPER, name: 'Helfer A', meshNodeId: '!abc' },
    })
    const [m] = mapTeamSyncLanEntriesToMessages(
      [{ id: 'lan-1', wire, createdAt: 1_700_000_000_000, recipientAddresses: [HELPER] }],
      HELPER
    )
    expect(m?.source).toBe('lan')
    expect(m?.transports).toEqual(['lan'])
    expect(m?.from).toBe(BOSS)
    expect(m?.dedupKey).toBe('team-sync-v1|alpha|7')
    expect(m?.id).toBe('team-sync-lan:lan-1')
  })
})
