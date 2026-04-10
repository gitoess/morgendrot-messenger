import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseSimpleOkEnvelopeText } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

/**
 * Nur Server-seitiger Klartext-Inbox-Cache (Datei …vault.inbox.enc). Kein Wallet nötig.
 * UI-Liste im Browser separat leeren (setMessages([])).
 */
export async function clearLocalHistory(options?: {
  shred?: boolean
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/clear-local-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shred: options?.shred !== false }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseSimpleOkEnvelopeText(fr.text)
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, message: r.message }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
