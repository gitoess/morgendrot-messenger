import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseSimpleOkEnvelopeText } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

/** Backend neu starten (POST /api/restart). Nach Erfolg ist die Verbindung weg. */
export async function restartBackend(): Promise<{ ok: boolean; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/restart', { method: 'POST' })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseSimpleOkEnvelopeText(fr.text)
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
