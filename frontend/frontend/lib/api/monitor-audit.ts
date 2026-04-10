import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

/** Geräte-Status für Radar (GET /api/monitor-status). Boss/Kommandant: alle Worker mit letztem Heartbeat. */
export async function fetchMonitorStatus(): Promise<{ ok: boolean; devices?: Array<{ device: string; lastSeen: number; status: string }>; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/monitor-status')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Monitor-Status nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return { ok: true, devices: Array.isArray(b.devices) ? (b.devices as Array<{ device: string; lastSeen: number; status: string }>) : undefined }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

/** Audit-Events für Timeline/Radar (GET /api/audit-events). */
export type AuditEvent = { ts: number; type: string; device?: string; message?: string; [key: string]: unknown }

export async function fetchAuditEvents(limit = 100): Promise<{ ok: boolean; events?: AuditEvent[]; error?: string }> {
  try {
    const fr = await fetchApiText(
      API_BASE,
      `/api/audit-events?limit=${Math.max(1, Math.min(500, limit))}`
    )
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Audit-Events nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return { ok: true, events: Array.isArray(b.events) ? (b.events as AuditEvent[]) : [] }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
