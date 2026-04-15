import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { API_BASE } from '@/frontend/lib/api/api-base'
import type { EinsatzRoleTemplate } from '@morgendrot/shared/einsatz-role-templates'

/** Wie `docs/API-EINSATZ-ROLE-TEMPLATES.md` — Boss-PC, keine Chain; Typ aus `src/shared`. */
export type { EinsatzRoleTemplate }

/** GET/POST `/api/einsatz-role-templates` — JSON-Parsing (Vitest, § H.1a / H.3g). */
export function parseEinsatzRoleTemplatesResponse(text: string, httpStatus: number): {
  ok: boolean
  templates?: EinsatzRoleTemplate[]
  message?: string
  error?: string
} {
  let body: { ok?: boolean; templates?: unknown; message?: string; error?: string }
  try {
    body = JSON.parse(text) as typeof body
  } catch {
    return { ok: false, error: 'Antwort ist kein gültiges JSON.' }
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Unerwartetes Antwortformat.' }
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return { ok: false, error: body.error || `HTTP ${httpStatus}` }
  }
  if (!body.ok) {
    return { ok: false, error: body.error || 'API meldet Fehler.' }
  }
  const templates = Array.isArray(body.templates) ? (body.templates as EinsatzRoleTemplate[]) : []
  return { ok: true, templates, message: typeof body.message === 'string' ? body.message : undefined }
}

export async function fetchEinsatzRoleTemplates(): Promise<{
  ok: boolean
  templates?: EinsatzRoleTemplate[]
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/einsatz-role-templates')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseEinsatzRoleTemplatesResponse(fr.text, fr.response.status)
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, templates: r.templates }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

export async function saveEinsatzRoleTemplates(templates: EinsatzRoleTemplate[]): Promise<{
  ok: boolean
  templates?: EinsatzRoleTemplate[]
  message?: string
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/einsatz-role-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    return parseEinsatzRoleTemplatesResponse(fr.text, fr.response.status)
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
