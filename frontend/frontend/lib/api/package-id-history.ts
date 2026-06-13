import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

/** GET /api/package-id-history – aktuelle ID, Verlauf, optional von der Chain entdeckte Package-IDs. */
export async function fetchPackageIdHistory(): Promise<{
  ok: boolean
  current?: string
  history?: string[]
  discovered?: string[]
  hints?: Record<string, unknown>
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/package-id-history')
    if (!fr.ok) return { ok: false, error: fr.error }
    if (fr.response.status === 404) {
      return { ok: false, error: 'Endpoint /api/package-id-history fehlt — Boss-Backend neu starten.' }
    }
    if (fr.response.status >= 400) {
      return { ok: false, error: `Package-ID-Verlauf: HTTP ${fr.response.status}` }
    }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Package-ID-Verlauf nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      current: typeof b.current === 'string' ? b.current : '',
      history: Array.isArray(b.history) ? (b.history as string[]) : [],
      discovered: Array.isArray(b.discovered) ? (b.discovered as string[]) : [],
      hints: b.hints && typeof b.hints === 'object' && !Array.isArray(b.hints) ? (b.hints as Record<string, unknown>) : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
