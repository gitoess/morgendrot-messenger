import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

/** Hilfetext vom Backend (GET /api/help) – kontextabhängig (Start vs. verbunden). */
export async function fetchHelp(): Promise<{ ok: boolean; helpText?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/help')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Hilfetext nicht verfügbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const helpText = typeof r.body.helpText === 'string' ? r.body.helpText : undefined
    return { ok: true, helpText }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
