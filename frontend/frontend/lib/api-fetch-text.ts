import { toAppError } from '@/frontend/lib/app-error'
import { getApiBase } from '@/frontend/lib/api/api-base'
import { withApiAuthHeaders } from '@/frontend/lib/api-auth-header'

const NETWORKISH =
  /failed to fetch|network|load failed|Connection refused|aborted|AbortError|message channel closed|asynchronous response/i

/** Erster Satz der Netzwerk-Hinweismeldung — für Abgleich in Inbox/UI (§ H.2). */
const FETCH_NETWORK_OFFLINE_FIRST_CLAUSE = 'Backend nicht erreichbar oder abgebrochen' as const

/** Kanonischer Timeout-Text nach `fetch`/`AbortSignal` (überall gleicher Wortlaut). */
export const USER_MSG_FETCH_TIMEOUT = 'Zeitüberschreitung (Timeout).' as const

/** Kanonische Netzwerk-/Offline-Meldung (`fetchApiText`, `executeCommand`, …). */
export const USER_MSG_FETCH_NETWORK_OFFLINE =
  `${FETCH_NETWORK_OFFLINE_FIRST_CLAUSE}. Tor/SOCKS, „npm run dev“ und Wallet prüfen.` as const

/** Ob `raw` die kanonische Fetch-Netzmeldung (oder ein klarer Teiltreffer) ist — für Inbox-Banner ohne duplizierte Regex-Pflege. */
export function userMessageIndicatesFetchNetworkFailure(raw: string): boolean {
  return raw.includes(FETCH_NETWORK_OFFLINE_FIRST_CLAUSE)
}

/**
 * Einheitliche Nutzermeldung bei typischen Fetch-Netzwerkfehlern (gleicher Wortlaut wie `executeCommand`).
 */
export function formatFetchFailureMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === 'TimeoutError') {
    return USER_MSG_FETCH_TIMEOUT
  }
  const msg = toAppError(e).message
  if (NETWORKISH.test(msg)) {
    return USER_MSG_FETCH_NETWORK_OFFLINE
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
function withMutationApiAuth(init?: RequestInit): RequestInit | undefined {
  const method = (init?.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return init
  return withApiAuthHeaders(init)
}

export async function fetchApiText(
  apiBase: string,
  path: string,
  init?: RequestInit
): Promise<
  | { ok: true; response: Response; text: string }
  | { ok: false; error: string }
> {
  try {
    const url = joinApiUrl(apiBase || getApiBase(), path)
    const response = await fetch(url, withMutationApiAuth(init))
    const text = await response.text()
    return { ok: true, response, text }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
