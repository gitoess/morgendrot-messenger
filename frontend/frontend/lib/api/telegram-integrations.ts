import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { API_BASE } from '@/frontend/lib/api/api-base'

export type TelegramInboundMode = 'off' | 'longPoll' | 'webhook'

export type TelegramIntegrationPublic = {
  ok?: boolean
  enabled: boolean
  botTokenConfigured: boolean
  botToken: string
  botTokenMasked: string
  botUserId: string
  adminChatId: string
  relayBaseUrl: string
  relayReachable: boolean
  monitorWebhookActive: boolean
  inboundMode: TelegramInboundMode
  inboundPollActive: boolean
  einsatzGroupChatId: string
  einsatzGroupLabel: string
  einsatzGroupInviteLink: string
  einsatzGroupAlarmEnabled: boolean
  error?: string
}

function emptyTelegramPublic(): TelegramIntegrationPublic {
  return {
    enabled: false,
    botTokenConfigured: false,
    botToken: '',
    botTokenMasked: '',
    botUserId: '',
    adminChatId: '',
    relayBaseUrl: 'http://127.0.0.1:8787',
    relayReachable: false,
    monitorWebhookActive: false,
    inboundMode: 'off',
    inboundPollActive: false,
    einsatzGroupChatId: '',
    einsatzGroupLabel: '',
    einsatzGroupInviteLink: '',
    einsatzGroupAlarmEnabled: false,
  }
}

function parseTelegramPublic(text: string, httpStatus: number): TelegramIntegrationPublic & { ok: boolean; error?: string } {
  let body: TelegramIntegrationPublic & { ok?: boolean; error?: string }
  try {
    body = JSON.parse(text) as typeof body
  } catch {
    return { ok: false, error: 'Antwort ist kein gültiges JSON.', ...emptyTelegramPublic() }
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return { ok: false, error: body.error || `HTTP ${httpStatus}`, ...emptyTelegramPublic() }
  }
  if (body.ok === false) {
    return { ok: false, error: body.error || 'API-Fehler', ...emptyTelegramPublic() }
  }
  const inboundMode: TelegramInboundMode =
    body.inboundMode === 'longPoll' || body.inboundMode === 'webhook' ? body.inboundMode : 'off'
  return {
    ok: true,
    enabled: body.enabled === true,
    botTokenConfigured: body.botTokenConfigured === true,
    botToken: body.botToken || '',
    botTokenMasked: body.botTokenMasked || '',
    botUserId: body.botUserId || '',
    adminChatId: body.adminChatId || '',
    relayBaseUrl: body.relayBaseUrl || 'http://127.0.0.1:8787',
    relayReachable: body.relayReachable === true,
    monitorWebhookActive: body.monitorWebhookActive === true,
    inboundMode,
    inboundPollActive: body.inboundPollActive === true,
    einsatzGroupChatId: body.einsatzGroupChatId || '',
    einsatzGroupLabel: body.einsatzGroupLabel || '',
    einsatzGroupInviteLink: body.einsatzGroupInviteLink || '',
    einsatzGroupAlarmEnabled: body.einsatzGroupAlarmEnabled === true,
  }
}

export async function fetchTelegramIntegration(): Promise<TelegramIntegrationPublic & { ok: boolean; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/integrations/telegram')
    if (!fr.ok) {
      return { ok: false, error: fr.error, ...emptyTelegramPublic() }
    }
    return parseTelegramPublic(fr.text, fr.response.status)
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e), ...emptyTelegramPublic() }
  }
}

export async function saveTelegramIntegration(body: {
  enabled?: boolean
  botToken?: string
  adminChatId?: string
  relayBaseUrl?: string
  inboundMode?: TelegramInboundMode
  einsatzGroupChatId?: string
  einsatzGroupLabel?: string
  einsatzGroupInviteLink?: string
  einsatzGroupAlarmEnabled?: boolean
}): Promise<TelegramIntegrationPublic & { ok: boolean; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/integrations/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ...parseTelegramPublic('{}', 500), error: fr.error }
    return parseTelegramPublic(fr.text, fr.response.status)
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e), ...emptyTelegramPublic() }
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

export type TelegramGroupAlarmEventType = 'sos' | 'team_update' | 'boss_alarm' | 'monitor'

export async function postTelegramGroupAlarm(body: {
  eventType: TelegramGroupAlarmEventType
  seq?: number
  tgSeq?: number
  bossShort?: string
  deviceLabel?: string
  teamLabel?: string
}): Promise<{ ok: boolean; delivered?: boolean; skipped?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/integrations/telegram/group-alarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    let parsed: { ok?: boolean; delivered?: boolean; skipped?: string; error?: string }
    try {
      parsed = JSON.parse(fr.text) as typeof parsed
    } catch {
      return { ok: false, error: 'Antwort ist kein JSON.' }
    }
    if (fr.response.status < 200 || fr.response.status >= 300) {
      return { ok: false, error: parsed.error || `HTTP ${fr.response.status}` }
    }
    return {
      ok: parsed.ok !== false,
      delivered: parsed.delivered === true,
      skipped: parsed.skipped,
      error: parsed.error,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
