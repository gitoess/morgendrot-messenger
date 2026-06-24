import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  markRosterPendingOnServer,
  refreshRosterPendingFromServer,
  syncHandoffSuggestionToServer,
  syncJoinRequestToServer,
} from './roster-pending-sync'
import { listRosterPendingSuggestions } from './team-roster-pending-store'
import { listPendingJoinRequests, upsertJoinRequestFromWire } from './team-join-request-store'

vi.mock('@/frontend/lib/api/roster-pending', () => ({
  fetchRosterPendingEntries: vi.fn(),
  upsertRosterPendingEntryApi: vi.fn(async () => ({ ok: true, entry: { id: 'srv-1' } })),
  setRosterPendingStatusApi: vi.fn(async () => ({ ok: true })),
}))

import {
  fetchRosterPendingEntries,
  setRosterPendingStatusApi,
  upsertRosterPendingEntryApi,
} from '@/frontend/lib/api/roster-pending'

const BOSS = `0x${'b'.repeat(64)}`
const HELPER = `0x${'c'.repeat(64)}`

describe('roster-pending-sync', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('syncHandoffSuggestionToServer upsertet Handoff-Eintrag', async () => {
    const r = await syncHandoffSuggestionToServer({
      id: 'rp-local',
      member: { address: HELPER, name: 'Anna' },
      handoffLabel: 'helfer',
      registryEntryId: 'reg-1',
    })
    expect(r.ok).toBe(true)
    expect(upsertRosterPendingEntryApi).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'handoff', id: 'rp-local', member: { address: HELPER, name: 'Anna' } })
    )
  })

  it('syncJoinRequestToServer nutzt requestId als Server-ID', async () => {
    const r = await syncJoinRequestToServer({
      requestId: 'jr-1',
      member: { address: HELPER, name: 'Max' },
      boss: BOSS,
    })
    expect(r.ok).toBe(true)
    expect(upsertRosterPendingEntryApi).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'join_request', id: 'jr-1', requestId: 'jr-1' })
    )
  })

  it('refreshRosterPendingFromServer merged Handoff + Join in localStorage', async () => {
    vi.mocked(fetchRosterPendingEntries).mockResolvedValue({
      ok: true,
      entries: [
        {
          id: 'rp-srv',
          kind: 'handoff',
          status: 'pending',
          member: { address: HELPER, name: 'Handoff Server' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          handoffLabel: 'helfer',
        },
        {
          id: 'jr-srv',
          kind: 'join_request',
          status: 'pending',
          requestId: 'jr-srv',
          member: { address: `0x${'d'.repeat(64)}`, name: 'Join Server' },
          boss: BOSS,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    })

    const r = await refreshRosterPendingFromServer()
    expect(r.ok).toBe(true)
    expect(listRosterPendingSuggestions()).toHaveLength(1)
    expect(listRosterPendingSuggestions()[0].member.name).toBe('Handoff Server')
    expect(listPendingJoinRequests()).toHaveLength(1)
    expect(listPendingJoinRequests()[0].applicant.name).toBe('Join Server')
    expect(upsertRosterPendingEntryApi).not.toHaveBeenCalled()
  })

  it('upsertJoinRequestFromWire triggert Server-Sync', async () => {
    upsertJoinRequestFromWire({
      v: 1,
      requestId: 'jr-wire',
      applicant: { address: HELPER, name: 'Wire' },
      boss: BOSS,
      issuedAt: Date.now(),
    })
    await vi.waitFor(() => {
      expect(upsertRosterPendingEntryApi).toHaveBeenCalled()
    })
  })

  it('markRosterPendingOnServer setzt Status', async () => {
    const r = await markRosterPendingOnServer('rp-1', 'approved')
    expect(r.ok).toBe(true)
    expect(setRosterPendingStatusApi).toHaveBeenCalledWith('rp-1', 'approved')
  })
})
