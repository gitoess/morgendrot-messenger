import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { API_BASE } from '@/frontend/lib/api/api-base'

export type TelegramNotifyResult = {
  ok: boolean
  delivered?: boolean
  skipped?: string
  error?: string
}

export async function notifyTelegramContact(body: {
  recipientAddress: string
  messagePreview: string
  senderLabel?: string
  /** Kein Journal-Eintrag (z. B. Nebenkanal nach IOTA-Send — vermeidet Doppelzeile im Posteingang). */
  skipJournal?: boolean
}): Promise<TelegramNotifyResult> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/integrations/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    let parsed: TelegramNotifyResult & { ok?: boolean }
    try {
      parsed = JSON.parse(fr.text) as typeof parsed
    } catch {
      return { ok: false, error: 'Notify-Antwort ist kein JSON.' }
    }
    if (parsed.error && !parsed.delivered) return { ok: false, error: parsed.error, skipped: parsed.skipped }
    return {
      ok: true,
      delivered: parsed.delivered === true,
      skipped: parsed.skipped,
      error: parsed.error,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

export async function testTelegramNotify(targetChatId: string): Promise<{
  ok: boolean
  message?: string
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/integrations/telegram/test-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_chat_id: targetChatId }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const body = JSON.parse(fr.text) as { ok?: boolean; message?: string; error?: string }
    if (!body.ok) return { ok: false, error: body.error || 'Test fehlgeschlagen' }
    return { ok: true, message: body.message }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
