/** Für UI-Statuszeilen: niemals `[object Object]`. */
export function formatUnknownError(e: unknown): string {
  if (e instanceof Error) return e.message || e.name || 'Fehler'
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    if (typeof o.message === 'string' && o.message.trim()) return o.message
    if (typeof o.error === 'string' && o.error.trim()) return o.error
    try {
      const s = JSON.stringify(e)
      if (s && s !== '{}') return s
    } catch {
      /* ignore */
    }
  }
  return String(e)
}
