'use client'

import { wipeAllInboxCacheKeys, EINSATZ_END_CACHE_WIPED_EVENT } from '@/frontend/lib/einsatz-end-cache-wipe'
import { clearInboxBrowserViewFilters } from '@/frontend/lib/inbox-browser-view-state'
import { clearLocalHistory } from '@/frontend/lib/api/clear-local-history'

export type ClearInboxCachesResult = {
  ok: boolean
  message?: string
  error?: string
  removedBrowserCacheKeys?: number
  serverCleared?: boolean
}

/**
 * Server `.inbox.enc` + Browser-localStorage-Inbox-Cache + Chat-RAM (via Event).
 * Chain-Posteingang bleibt — nach Leeren „Aktualisieren“ im Chat oder kurz warten (Auto-Poll pausiert).
 */
export async function clearAllInboxCaches(): Promise<ClearInboxCachesResult> {
  const removedBrowserCacheKeys =
    typeof window !== 'undefined' ? wipeAllInboxCacheKeys() : 0
  if (typeof window !== 'undefined') {
    clearInboxBrowserViewFilters()
    try {
      window.dispatchEvent(new CustomEvent(EINSATZ_END_CACHE_WIPED_EVENT))
    } catch {
      /* ignore */
    }
  }
  const server = await clearLocalHistory({ shred: true })
  const parts: string[] = []
  if (removedBrowserCacheKeys > 0) {
    parts.push(`${removedBrowserCacheKeys} Browser-Cache-Einträge entfernt`)
  } else {
    parts.push('Kein Browser-Inbox-Cache (localStorage) gefunden')
  }
  if (server.ok) {
    parts.push('Server-Inbox-Cache (.inbox.enc) geschreddert')
  } else if (server.error) {
    parts.push(`Server-Cache: ${server.error}`)
  }
  parts.push(
    'Hinweis: Nachrichten auf der Chain/Mailbox erscheinen beim nächsten „Aktualisieren“ im Posteingang erneut — das ist kein Chain-Purge.'
  )
  return {
    ok: server.ok || removedBrowserCacheKeys > 0,
    message: parts.join('. '),
    error: server.ok ? undefined : server.error,
    removedBrowserCacheKeys,
    serverCleared: server.ok,
  }
}
