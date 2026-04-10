/** Explizit setzen, wenn kein Next-Rewrite (z. B. statischer Export). Sonst leer = gleiche Origin + `rewrites` in next.config.mjs. */
function resolveApiBase(): string {
  const explicit = (process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/$/, '')
  if (explicit) return explicit
  if (typeof window !== 'undefined') return ''
  return 'http://127.0.0.1:3342'
}

export const API_BASE = resolveApiBase()
