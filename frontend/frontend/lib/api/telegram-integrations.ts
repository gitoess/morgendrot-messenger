import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { API_BASE } from '@/frontend/lib/api/api-base'

export type TelegramInboundMode = 'off' | 'longPoll' | 'webhook'

export type TelegramIntegrationPublic = {
  ok?: boolean
  enabled: boolean
  botTokenConfigured: boolean
  botTokenMasked: string
  adminChatId: string
  relayBaseUrl: string
  relayReachable: boolean
  monitorWebhookActive: boolean
  inboundMode: TelegramInboundMode
  inboundPollActive: boolean
  error?: string
}

function parseTelegramPublic(text: string, httpStatus: number): TelegramIntegrationPublic & { ok: boolean; error?: string } {
  let body: TelegramIntegrationPublic & { ok?: boolean; error?: string }
  try {
    body = JSON.parse(text) as typeof body
  } catch {
    return {
      ok: false,
      error: 'Antwort ist kein gültiges JSON.',
      enabled: false,
      botTokenConfigured: false,
      botTokenMasked: '',
      adminChatId: '',
      relayBaseUrl: 'http://127.0.0.1:8787',
      relayReachable: false,
      monitorWebhookActive: false,
      inboundMode: 'off',
      inboundPollActive: false,
    }
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return {
      ok: false,
      error: body.error || `HTTP ${httpStatus}`,
      enabled: false,
      botTokenConfigured: false,
      botTokenMasked: '',
      adminChatId: '',
      relayBaseUrl: 'http://127.0.0.1:8787',
      relayReachable: false,
      monitorWebhookActive: false,
      inboundMode: 'off',
      inboundPollActive: false,
    }
  }
  if (body.ok === false) {
    return {
      ok: false,
      error: body.error || 'API-Fehler',
      enabled: false,
      botTokenConfigured: false,
      botTokenMasked: '',
      adminChatId: '',
      relayBaseUrl: 'http://127.0.0.1:8787',
      relayReachable: false,
      monitorWebhookActive: false,
      inboundMode: 'off',
      inboundPollActive: false,
    }
  }
  const inboundMode: TelegramInboundMode =
    body.inboundMode === 'longPoll' || body.inboundMode === 'webhook' ? body.inboundMode : 'off'
  return {
    ok: true,
    enabled: body.enabled === true,
    botTokenConfigured: body.botTokenConfigured === true,
    botTokenMasked: body.botTokenMasked || '',
    adminChatId: body.adminChatId || '',
    relayBaseUrl: body.relayBaseUrl || 'http://127.0.0.1:8787',
    relayReachable: body.relayReachable === true,
    monitorWebhookActive: body.monitorWebhookActive === true,
    inboundMode,
    inboundPollActive: body.inboundPollActive === true,
  }
}

export async function fetchTelegramIntegration(): Promise<TelegramIntegrationPublic & { ok: boolean; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/integrations/telegram')
    if (!fr.ok) {
      return {
        ok: false,
        error: fr.error,
        enabled: false,
        botTokenConfigured: false,
        botTokenMasked: '',
        adminChatId: '',
        relayBaseUrl: 'http://127.0.0.1:8787',
        relayReachable: false,
        monitorWebhookActive: false,
        inboundMode: 'off',
        inboundPollActive: false,
      }
    }
    return parseTelegramPublic(fr.text, fr.response.status)
  } catch (e) {
    return {
      ok: false,
      error: formatFetchFailureMessage(e),
      enabled: false,
      botTokenConfigured: false,
      botTokenMasked: '',
      adminChatId: '',
      relayBaseUrl: 'http://127.0.0.1:8787',
      relayReachable: false,
      monitorWebhookActive: false,
      inboundMode: 'off',
      inboundPollActive: false,
    }
  }
}

export async function saveTelegramIntegration(body: {
  enabled?: boolean
  botToken?: string
  adminChatId?: string
  relayBaseUrl?: string
  inboundMode?: TelegramInboundMode
}): Promise<TelegramIntegrationPublic & { ok: boolean; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/integrations/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ok: false, error: fr.error, ...parseTelegramPublic('{}', 500) }
    return parseTelegramPublic(fr.text, fr.response.status)
  } catch (e) {
    return {
      ok: false,
      error: formatFetchFailureMessage(e),
      enabled: false,
      botTokenConfigured: false,
      botTokenMasked: '',
      adminChatId: '',
      relayBaseUrl: 'http://127.0.0.1:8787',
      relayReachable: false,
      monitorWebhookActive: false,
    }
  }
}

export async function testTelegramAlarm(): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/integrations/telegram/test-alarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    let body: { ok?: boolean; message?: string; error?: string }
    try {
      body = JSON.parse(fr.text) as typeof body
    } catch {
      return { ok: false, error: 'Test-Antwort ist kein JSON — Backend neu starten?' }
    }
    if (fr.response.status < 200 || fr.response.status >= 300) {
      return { ok: false, error: body.error || `HTTP ${fr.response.status}` }
    }
    if (!body.ok) return { ok: false, error: body.error || 'Test fehlgeschlagen' }
    return { ok: true, message: body.message }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
