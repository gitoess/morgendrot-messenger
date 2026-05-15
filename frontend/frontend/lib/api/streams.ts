import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

/** M2b: Live-Hinweis an Gruppen-Streams-Anchor (Archiv bleibt Mailbox). */
export async function publishStreamsAnchor(
  anchorId: string,
  payload: Record<string, unknown> | string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/streams-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anchorId: anchorId.trim(),
        payload,
      }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Streams-Publish fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    return {
      ok: true,
      message: typeof r.body.message === 'string' ? r.body.message : undefined,
      error: typeof r.body.error === 'string' ? r.body.error : undefined,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
