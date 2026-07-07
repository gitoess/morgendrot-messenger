import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/frontend/lib/mailbox-send-hybrid', () => ({
  sendTeamPlaintextBroadcastHybrid: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/frontend/lib/api/team-sync-lan', () => ({
  postTeamSyncLanPush: vi.fn(async () => ({ ok: true, entryId: 'lan-1' })),
}))
vi.mock('@/frontend/lib/api/api-base', () => ({
  getApiBase: vi.fn(() => 'http://127.0.0.1:3342'),
}))
vi.mock('@/frontend/lib/api/telegram-integrations', () => ({
  postTelegramGroupAlarm: vi.fn(async () => ({ ok: true })),
}))

import { getApiBase } from '@/frontend/lib/api/api-base'
import { postTeamSyncLanPush } from '@/frontend/lib/api/team-sync-lan'
import { sendTeamPlaintextBroadcastHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import { publishTeamMemberUpdateWire } from './team-sync-wire'

const TEAM_MB = `0x${'a'.repeat(64)}`
const BOSS = `0x${'b'.repeat(64)}`
const MEMBER = `0x${'c'.repeat(64)}`

describe('team-sync-wire LAN push', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('sendet LAN-Push nach erfolgreichem IOTA auf Boss-LAN', async () => {
    const r = await publishTeamMemberUpdateWire({
      teamMailboxAddress: TEAM_MB,
      teamId: 'team-alpha',
      bossAddress: BOSS,
      kind: 'add',
      member: { address: MEMBER, name: 'Neu' },
      telegramGroupHint: false,
    })
    expect(r.ok).toBe(true)
    expect(sendTeamPlaintextBroadcastHybrid).toHaveBeenCalled()
    expect(postTeamSyncLanPush).toHaveBeenCalledWith(
      expect.objectContaining({
        teamMailboxAddress: TEAM_MB,
        teamId: 'team-alpha',
        wire: expect.stringContaining('[[MORG_TEAM_MEMBER_UPDATE_V1'),
      })
    )
    expect(r.channels).toEqual(expect.objectContaining({ iota: true, lan: true }))
  })

  it('überspringt LAN-Push außerhalb Boss-LAN', async () => {
    vi.mocked(getApiBase).mockReturnValue('https://api.example.com')
    const r = await publishTeamMemberUpdateWire({
      teamMailboxAddress: TEAM_MB,
      teamId: 'team-alpha',
      bossAddress: BOSS,
      kind: 'add',
      member: { address: MEMBER, name: 'Neu' },
      telegramGroupHint: false,
    })
    expect(r.ok).toBe(true)
    expect(postTeamSyncLanPush).not.toHaveBeenCalled()
    expect(r.channels?.lan).toBeUndefined()
  })
})
