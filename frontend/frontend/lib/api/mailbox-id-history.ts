import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

/** GET /api/mailbox-id-history – aktive MAILBOX_ID + frühere Shared-Postfächer. */
export async function fetchMailboxIdHistory(): Promise<{
  ok: boolean
  current?: string
  history?: string[]
  note?: string
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/mailbox-id-history')
    if (!fr.ok) return { ok: false, error: fr.error }
    if (fr.response.status === 404) {
      return { ok: false, error: 'Endpoint /api/mailbox-id-history fehlt — Boss-Backend neu starten.' }
    }
    if (fr.response.status >= 400) {
      return { ok: false, error: `Mailbox-ID-Verlauf: HTTP ${fr.response.status}` }
    }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Mailbox-ID-Verlauf nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      current: typeof b.current === 'string' ? b.current : '',
      history: Array.isArray(b.history) ? (b.history as string[]) : [],
      note: typeof b.note === 'string' ? b.note : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
