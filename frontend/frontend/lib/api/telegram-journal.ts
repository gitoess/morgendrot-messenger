import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { getApiBase } from '@/frontend/lib/api/api-base'

export type TelegramJournalEntryClient = {
  id: string
  direction: 'in' | 'out'
  chatId: string
  contactKey: string
  text: string
  senderLabel?: string
  ts: number
}

export async function fetchTelegramJournal(opts?: {
  contactKey?: string
  chatId?: string
  limit?: number
}): Promise<{ ok: boolean; entries?: TelegramJournalEntryClient[]; error?: string }> {
  try {
    const q = new URLSearchParams()
    if (opts?.contactKey?.trim()) q.set('contactKey', opts.contactKey.trim())
    if (opts?.chatId?.trim()) q.set('chatId', opts.chatId.trim())
    if (opts?.limit != null) q.set('limit', String(opts.limit))
    const path = `/api/integrations/telegram/journal${q.toString() ? `?${q}` : ''}`
    const fr = await fetchApiText(getApiBase(), path)
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Telegram-Journal nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const entries = r.body.entries
    if (!Array.isArray(entries)) return { ok: true, entries: [] }
    return { ok: true, entries: entries as TelegramJournalEntryClient[] }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
