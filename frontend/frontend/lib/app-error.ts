/**
 * Einheitliches Fehlerobjekt für UI, Tests und Grenz-Validierung (Phase A / § H.1a).
 * Nicht jeder Legacy-Pfad nutzt AppError noch — neue und refaktorierte Stellen hier anbinden.
 */

export type AppError = {
  code: string
  message: string
  cause?: unknown
}

export function isAppError(e: unknown): e is AppError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    'message' in e &&
    typeof (e as AppError).code === 'string' &&
    typeof (e as AppError).message === 'string'
  )
}

export function appError(code: string, message: string, cause?: unknown): AppError {
  return cause === undefined ? { code, message } : { code, message, cause }
}

function messageFromDomEvent(e: Event): string | null {
  const t = e.target
  if (t instanceof HTMLScriptElement && t.src) return `Skript konnte nicht geladen werden: ${t.src}`
  if (t instanceof HTMLLinkElement && t.href) return `Ressource konnte nicht geladen werden: ${t.href}`
  if (typeof ErrorEvent !== 'undefined' && e instanceof ErrorEvent && e.message) return e.message
  return null
}

/** Mappt Throws/Fetch-Fails in ein AppError (Klartext für Toast; code für Telemetrie/Tests). */
export function toAppError(e: unknown, fallbackCode = 'UNKNOWN'): AppError {
  if (isAppError(e)) return e
  if (e instanceof Error) return { code: fallbackCode, message: e.message, cause: e }
  if (typeof e === 'string') return { code: fallbackCode, message: e }
  if (typeof Event !== 'undefined' && e instanceof Event) {
    const msg = messageFromDomEvent(e)
    if (msg) return { code: fallbackCode, message: msg, cause: e }
  }
  try {
    return { code: fallbackCode, message: JSON.stringify(e) }
  } catch {
    return { code: fallbackCode, message: String(e) }
  }
}
