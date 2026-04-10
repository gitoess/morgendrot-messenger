import { parseApiJsonEnvelope, type ApiEnvelope } from '@/frontend/lib/api-response-guard'

export type SimpleOkEnvelopeSuccess = { ok: true; message?: string }
export type SimpleOkEnvelopeFailure = { ok: false; error: string }

export type OkEnvelopePassthroughSuccess = { ok: true; body: ApiEnvelope }
export type OkEnvelopePassthroughFailure = { ok: false; error: string }

function parseFailureMessage(parsed: {
  ok: false
  error: 'invalid_json' | 'schema'
}): string {
  return parsed.error === 'invalid_json'
    ? 'Antwort vom Backend ist kein gültiges JSON.'
    : 'Unerwartetes Antwortformat (API).'
}

/**
 * JSON mit mindestens `{ ok: boolean }` – bei `ok: true` voller Server-Body (passthrough) für Feldzugriff.
 */
export function parseOkEnvelopePassthrough(
  text: string,
  opts?: { falseOkFallback?: string }
): OkEnvelopePassthroughSuccess | OkEnvelopePassthroughFailure {
  const parsed = parseApiJsonEnvelope(text)
  if (!parsed.ok) {
    return { ok: false, error: parseFailureMessage(parsed) }
  }
  const d = parsed.data
  if (d.ok === false) {
    const rec = d as { error?: string; message?: string }
    const err =
      (typeof rec.error === 'string' && rec.error.length > 0 && rec.error) ||
      (typeof rec.message === 'string' && rec.message.length > 0 && rec.message) ||
      opts?.falseOkFallback ||
      'Anfrage fehlgeschlagen.'
    return { ok: false, error: err }
  }
  if (d.ok === true) {
    return { ok: true, body: d }
  }
  return { ok: false, error: opts?.falseOkFallback || 'Unerwartete API-Antwort.' }
}

/**
 * Typische API-Antworten mit `{ ok: boolean, error?, message? }` nach Zod-Mindesthülle.
 * Erfolg: `ok: true` und optionales `message`. Fehler: `ok: false` oder Parse/Schema.
 */
export function parseSimpleOkEnvelopeText(
  text: string,
  opts?: { falseOkFallback?: string }
): SimpleOkEnvelopeSuccess | SimpleOkEnvelopeFailure {
  const r = parseOkEnvelopePassthrough(text, opts)
  if (!r.ok) return r
  const message =
    typeof r.body.message === 'string' && r.body.message.length > 0 ? r.body.message : undefined
  return { ok: true, message }
}
