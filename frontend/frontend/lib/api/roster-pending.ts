import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

export type RosterPendingMemberClient = {
  address: string
  name: string
  roleTags?: string[]
  meshNodeId?: string
  telegramChatId?: string
  roleId?: number
  handoffLabel?: string
}

export type RosterPendingEntryClient = {
  id: string
  kind: 'handoff' | 'join_request'
  status: 'pending' | 'approved' | 'dismissed' | 'rejected'
  member: RosterPendingMemberClient
  createdAt: number
  updatedAt: number
  handoffLabel?: string
  registryEntryId?: string
  requestId?: string
  boss?: string
  teamId?: string
  note?: string
  issuedAt?: number
}

export async function fetchRosterPendingEntries(status = 'pending'): Promise<{
  ok: boolean
  entries?: RosterPendingEntryClient[]
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, `/api/roster-pending?status=${encodeURIComponent(status)}`)
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Roster-Pending konnte nicht geladen werden.' })
    if (!r.ok) return { ok: false, error: r.error }
    const entries = (r.body.entries as RosterPendingEntryClient[] | undefined) ?? []
    return { ok: true, entries }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

export async function upsertRosterPendingEntryApi(input: {
  id?: string
  kind: 'handoff' | 'join_request'
  member: RosterPendingMemberClient
  handoffLabel?: string
  registryEntryId?: string
  requestId?: string
  boss?: string
  teamId?: string
  note?: string
  issuedAt?: number
}): Promise<{ ok: boolean; entry?: RosterPendingEntryClient; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/roster-pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Roster-Pending speichern fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, entry: r.body.entry as RosterPendingEntryClient }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

export async function setRosterPendingStatusApi(
  id: string,
  status: 'approved' | 'dismissed' | 'rejected'
): Promise<{ ok: boolean; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, `/api/roster-pending/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Status-Update fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
