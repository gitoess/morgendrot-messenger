/** Für UI-Statuszeilen: niemals `[object Object]`. */
export function formatUnknownError(e: unknown): string {
  if (e instanceof Error) {
    const m = (e.message || '').trim()
    if (m && m !== '[object Object]') return m
    if (e.name && e.name !== 'Error') return e.name
    /** `new Error(plainObject)` → message ist „[object Object]“. */
    const cause = (e as Error & { cause?: unknown }).cause
    if (cause != null) return formatUnknownError(cause)
    return e.name || 'Fehler'
  }
  if (typeof e === 'string') {
    if (e.trim() === '[object Object]') return 'Funk-Fehler (Objekt ohne Text)'
    return e
  }
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    if (typeof o.message === 'string' && o.message.trim() && o.message !== '[object Object]') {
      return o.message
    }
    if (typeof o.error === 'string' && o.error.trim()) return o.error
    if (typeof o.error === 'number' && Number.isFinite(o.error)) {
      return `Funk-Routing-Fehler ${o.error}${o.id != null ? ` (Paket ${String(o.id)})` : ''}`
    }
    try {
      const s = JSON.stringify(e)
      if (s && s !== '{}' && s !== 'null') return s
    } catch {
      /* ignore */
    }
  }
  const fallback = String(e)
  return fallback === '[object Object]' ? 'Funk-Fehler (nicht lesbar)' : fallback
}
