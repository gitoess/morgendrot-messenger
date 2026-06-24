'use client'

/**
 * Boss-Roster Pending: localStorage ↔ server queue (§ H.36 P1).
 */
import {
  fetchRosterPendingEntries,
  setRosterPendingStatusApi,
  upsertRosterPendingEntryApi,
  type RosterPendingEntryClient,
} from '@/frontend/lib/api/roster-pending'
import type { TeamMemberWireMember } from '@/frontend/lib/morg-team-member-update-v1'
import { upsertJoinRequestFromWire } from '@/frontend/lib/team-join-request-store'
import { enqueueRosterPendingSuggestion } from '@/frontend/lib/team-roster-pending-store'

export async function syncHandoffSuggestionToServer(input: {
  id?: string
  member: TeamMemberWireMember
  handoffLabel?: string
  registryEntryId?: string
}): Promise<{ ok: boolean; error?: string }> {
  const r = await upsertRosterPendingEntryApi({
    ...(input.id ? { id: input.id } : {}),
    kind: 'handoff',
    member: input.member,
    handoffLabel: input.handoffLabel,
    registryEntryId: input.registryEntryId,
  })
  return { ok: r.ok, error: r.error }
}

export async function syncJoinRequestToServer(input: {
  requestId: string
  member: TeamMemberWireMember
  boss?: string
  teamId?: string
  note?: string
  issuedAt?: number
}): Promise<{ ok: boolean; error?: string }> {
  const r = await upsertRosterPendingEntryApi({
    id: input.requestId,
    kind: 'join_request',
    requestId: input.requestId,
    member: input.member,
    boss: input.boss,
    teamId: input.teamId,
    note: input.note,
    issuedAt: input.issuedAt,
  })
  return { ok: r.ok, error: r.error }
}

function mergeServerHandoffEntry(entry: RosterPendingEntryClient): void {
  enqueueRosterPendingSuggestion({
    id: entry.id,
    source: 'handoff',
    member: entry.member,
    handoffLabel: entry.handoffLabel,
    registryEntryId: entry.registryEntryId,
  })
}

function mergeServerJoinEntry(entry: RosterPendingEntryClient): void {
  if (!entry.requestId) return
  upsertJoinRequestFromWire(
    {
      v: 1,
      requestId: entry.requestId,
      applicant: entry.member,
      boss: entry.boss || '',
      issuedAt: entry.issuedAt ?? entry.createdAt,
      ...(entry.teamId ? { teamId: entry.teamId } : {}),
      ...(entry.note ? { note: entry.note } : {}),
    },
    { skipServerSync: true }
  )
}

export async function refreshRosterPendingFromServer(): Promise<{ ok: boolean; error?: string }> {
  const r = await fetchRosterPendingEntries('pending')
  if (!r.ok) return { ok: false, error: r.error }
  for (const entry of r.entries ?? []) {
    if (entry.kind === 'handoff') mergeServerHandoffEntry(entry)
    else if (entry.kind === 'join_request') mergeServerJoinEntry(entry)
  }
  return { ok: true }
}

export async function markRosterPendingOnServer(
  id: string,
  status: 'approved' | 'dismissed' | 'rejected'
): Promise<{ ok: boolean; error?: string }> {
  const r = await setRosterPendingStatusApi(id, status)
  return { ok: r.ok, error: r.error }
}
