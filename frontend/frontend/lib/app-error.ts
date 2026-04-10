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

/** Mappt Throws/Fetch-Fails in ein AppError (Klartext für Toast; code für Telemetrie/Tests). */
export function toAppError(e: unknown, fallbackCode = 'UNKNOWN'): AppError {
  if (isAppError(e)) return e
  if (e instanceof Error) return { code: fallbackCode, message: e.message, cause: e }
  if (typeof e === 'string') return { code: fallbackCode, message: e }
  try {
    return { code: fallbackCode, message: JSON.stringify(e) }
  } catch {
    return { code: fallbackCode, message: String(e) }
  }
}
