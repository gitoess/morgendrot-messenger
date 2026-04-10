import { toAppError } from '@/frontend/lib/app-error'

const NETWORKISH = /failed to fetch|network|load failed|Connection refused|aborted|AbortError/i

/**
 * Einheitliche Nutzermeldung bei typischen Fetch-Netzwerkfehlern (gleicher Wortlaut wie `executeCommand`).
 */
export function formatFetchFailureMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === 'TimeoutError') {
    return 'Zeitüberschreitung (Timeout).'
  }
  const msg = toAppError(e).message
  if (NETWORKISH.test(msg)) {
    return 'Backend nicht erreichbar oder abgebrochen. Tor/SOCKS, „npm run dev“ und Wallet prüfen.'
  }
  return msg
}

export function joinApiUrl(apiBase: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const b = apiBase.replace(/\/$/, '')
  return b ? `${b}${p}` : p
}

/**
 * `fetch` + `response.text()` mit gemeinsamem Catch (kein `response.json()`).
 * `path` z. B. `/api/status` oder `/api/audit-events?limit=10`.
 */
export async function fetchApiText(
  apiBase: string,
  path: string,
  init?: RequestInit
): Promise<
  | { ok: true; response: Response; text: string }
  | { ok: false; error: string }
> {
  try {
    const url = joinApiUrl(apiBase, path)
    const response = await fetch(url, init)
    const text = await response.text()
    return { ok: true, response, text }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
