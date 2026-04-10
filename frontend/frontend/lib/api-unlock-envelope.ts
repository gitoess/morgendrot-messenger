import { parseSimpleOkEnvelopeText } from '@/frontend/lib/api-simple-ok-envelope'

/** POST /api/unlock – Roh-Text → `{ ok, error? }` für die UI. */
export function parseUnlockBackendEnvelopeText(text: string): { ok: boolean; error?: string } {
  const r = parseSimpleOkEnvelopeText(text, { falseOkFallback: 'Entsperren fehlgeschlagen.' })
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true }
}
