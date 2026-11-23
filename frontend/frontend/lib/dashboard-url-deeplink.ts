/**
 * Optionale URL-Shortcuts für den Messenger-Desktop (PC Stage-2).
 * Beispiel: `/?t=inbox-messages` → Chat/Posteingang öffnen.
 * Query wird nach dem Anwenden entfernt (kein Bookmark-Loop).
 */

export type DashboardUrlDeeplink = 'chat'

const CHAT_TOKENS = new Set(['inbox-messages', 'messages', 'chat', 'private-chat', 'posteingang'])

export function parseDashboardUrlDeeplink(search: string): DashboardUrlDeeplink | null {
  const raw = String(search || '').trim()
  const q = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  const t = (q.get('t') || q.get('view') || '').trim().toLowerCase()
  if (!t) return null
  if (CHAT_TOKENS.has(t)) return 'chat'
  return null
}

/** Entfernt bekannte Deeplink-Parameter; Rest der Query bleibt. */
export function stripDashboardUrlDeeplinkSearch(search: string): string {
  const raw = String(search || '').trim()
  const q = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  q.delete('t')
  q.delete('view')
  const s = q.toString()
  return s ? `?${s}` : ''
}
