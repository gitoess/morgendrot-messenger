/**
 * Defensive JSON-/Form-Parsing an der API-Grenze (Zod).
 */
import { z } from 'zod'

const minimalOkEnvelope = z
  .object({
    ok: z.boolean(),
  })
  .passthrough()

export type ApiEnvelope = z.infer<typeof minimalOkEnvelope>

export type ParseApiJsonResult =
  | { ok: true; data: ApiEnvelope }
  | { ok: false; error: 'invalid_json' | 'schema'; raw?: string }

/** Parst Response-Text; bei Erfolg mindestens `{ ok: boolean }` erzwungen. */
export function parseApiJsonEnvelope(text: string): ParseApiJsonResult {
  let u: unknown
  try {
    u = JSON.parse(text) as unknown
  } catch {
    return { ok: false, error: 'invalid_json', raw: text.slice(0, 500) }
  }
  const r = minimalOkEnvelope.safeParse(u)
  if (!r.success) return { ok: false, error: 'schema' }
  return { ok: true, data: r.data }
}

export type ParseJsonObjectResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: 'invalid_json' | 'not_object'; raw?: string }

/** JSON-Objekt ohne `ok`-Pflicht (z. B. GET /api/status). */
export function parseJsonObjectRecord(text: string): ParseJsonObjectResult {
  let u: unknown
  try {
    u = JSON.parse(text) as unknown
  } catch {
    return { ok: false, error: 'invalid_json', raw: text.slice(0, 500) }
  }
  if (u === null || typeof u !== 'object' || Array.isArray(u)) {
    return { ok: false, error: 'not_object' }
  }
  return { ok: true, data: u as Record<string, unknown> }
}
