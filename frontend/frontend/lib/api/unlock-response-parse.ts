import { parseUnlockBackendEnvelopeText } from '@/frontend/lib/api-unlock-envelope'

export type UnlockBackendResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; code?: string }

/** Reines JSON aus POST /api/unlock (ohne fetch) — für Tests und `unlockBackend`. */
export function parseUnlockApiResponse(text: string, responseOk: boolean): UnlockBackendResult {
  let parsed: Record<string, unknown>
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    return { ok: false, error: 'Antwort vom Backend ist kein gültiges JSON.' }
  }
  if (parsed.ok === true) {
    const message = typeof parsed.message === 'string' && parsed.message.length > 0 ? parsed.message : undefined
    return { ok: true, message }
  }
  if (parsed.ok === false || !responseOk) {
    const err =
      (typeof parsed.error === 'string' && parsed.error) ||
      (typeof parsed.message === 'string' && parsed.message) ||
      'Entsperren fehlgeschlagen.'
    const code = typeof parsed.code === 'string' ? parsed.code : undefined
    return { ok: false, error: err, code }
  }
  return parseUnlockBackendEnvelopeText(text) as UnlockBackendResult
}
