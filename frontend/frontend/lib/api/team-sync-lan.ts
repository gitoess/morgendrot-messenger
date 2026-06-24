import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

export async function postTeamSyncLanPush(input: {
  wire: string
  teamMailboxAddress?: string
  teamId?: string
  seq?: number
  recipientAddresses?: string[]
}): Promise<{ ok: boolean; entryId?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/team-sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'LAN-Push fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const entryId = typeof r.body.entryId === 'string' ? r.body.entryId : undefined
    return { ok: true, entryId }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

export type TeamSyncLanInboxEntry = {
  id: string
  wire: string
  createdAt: number
  teamMailboxAddress?: string
  teamId?: string
  seq?: number
  recipientAddresses: string[]
}

export async function fetchTeamSyncLanInbox(opts: {
  address: string
  sinceMs?: number
}): Promise<{ ok: boolean; entries?: TeamSyncLanInboxEntry[]; error?: string }> {
  try {
    const q = new URLSearchParams({ address: opts.address.trim() })
    if (opts.sinceMs != null) q.set('sinceMs', String(opts.sinceMs))
    const fr = await fetchApiText(API_BASE, `/api/team-sync/lan-inbox?${q.toString()}`)
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'LAN-Inbox konnte nicht geladen werden.' })
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, entries: (r.body.entries as TeamSyncLanInboxEntry[]) ?? [] }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
