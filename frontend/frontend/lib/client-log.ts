/**
 * Zentrale Client-Logs für Chat/Send/BLE (nicht jeder Pfad migriert sofort).
 * Produktion: nur warn/error; Entwicklung: optional debug.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const NS = '[morgendrot]'

function emit(level: Level, scope: string, msg: string, data?: unknown): void {
  const line = `${NS} ${scope} ${msg}`
  if (level === 'debug') {
    if (process.env.NODE_ENV === 'development') {
      if (data !== undefined) console.debug(line, data)
      else console.debug(line)
    }
    return
  }
  if (level === 'info') {
    if (data !== undefined) console.info(line, data)
    else console.info(line)
    return
  }
  if (level === 'warn') {
    if (data !== undefined) console.warn(line, data)
    else console.warn(line)
    return
  }
  if (data !== undefined) console.error(line, data)
  else console.error(line)
}

export const clientLog = {
  debug: (scope: string, msg: string, data?: unknown) => emit('debug', scope, msg, data),
  info: (scope: string, msg: string, data?: unknown) => emit('info', scope, msg, data),
  warn: (scope: string, msg: string, data?: unknown) => emit('warn', scope, msg, data),
  error: (scope: string, msg: string, data?: unknown) => emit('error', scope, msg, data),
}
