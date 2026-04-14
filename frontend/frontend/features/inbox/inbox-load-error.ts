import {
  USER_MSG_FETCH_TIMEOUT,
  userMessageIndicatesFetchNetworkFailure,
} from '@/frontend/lib/api-fetch-text'

/** Heuristik: Netzwerk/Backend nicht erreichbar (executeCommand + fetch-Fehler). */
export function isInboxLoadErrorLikelyUnreachable(raw: string): boolean {
  if (raw === USER_MSG_FETCH_TIMEOUT || userMessageIndicatesFetchNetworkFailure(raw)) {
    return true
  }
  return /Backend nicht erreichbar|failed to fetch|network|load failed|Verbindung fehlgeschlagen|Connection refused|abgebrochen|AbortError|Timeout|Zeitüberschreitung|ECONNREFUSED|ENOTFOUND|fetch/i.test(
    raw
  )
}

export const INBOX_BASIS_OFFLINE_HEADLINE = 'Keine Verbindung zur Basis – Funk-Modus aktiv.'

export function formatInboxLoadError(raw: string): { headline: string; detail: string } {
  if (isInboxLoadErrorLikelyUnreachable(raw)) {
    return { headline: INBOX_BASIS_OFFLINE_HEADLINE, detail: raw }
  }
  return { headline: 'Fehler beim Laden', detail: raw }
}
