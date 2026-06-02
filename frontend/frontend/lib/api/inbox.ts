import type { Message } from '../types'
import { mapInboxApiRowsToMessages, type InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { pickInboxRawMessages } from '@/frontend/lib/inbox-pick-raw-messages'
import { executeCommand } from '@/frontend/lib/api/execute-command'
import { fetchMailboxInboxPage } from '@/frontend/lib/mailbox-inbox-page-fetch'
import { shouldSkipMessengerApiRelayFallback } from '@/frontend/lib/messenger-standalone-relay'

/** limit, optional senderFilter (0x…), optional packageId, optional bossView, optional offset (ältere Seiten). */
const INBOX_FETCH_TIMEOUT_MS = 45_000

export const fetchInbox = (
  limit = 20,
  senderFilter?: string,
  packageId?: string,
  bossView?: boolean,
  offset = 0,
  mergeLocalInbox = false,
  mailboxObjectId?: string,
  silentFetch?: boolean,
  mailboxKeysOnly?: boolean
) =>
  executeCommand<Message[]>(
    '/inbox',
    bossView
      ? [String(limit), senderFilter ?? '', packageId ?? '', 'boss', mergeLocalInbox ? 'true' : '', String(offset)]
      : [String(limit), senderFilter ?? '', packageId ?? '', '', mergeLocalInbox ? 'true' : '', String(offset)],
    { timeoutMs: INBOX_FETCH_TIMEOUT_MS, mailboxObjectId, silentFetch, mailboxKeysOnly }
  )

/** Alle Posteingangs-Nachrichten (paginiert bis leer) – für Exporte, unabhängig von der aktuell geladenen UI-Seite. */
export async function fetchAllInboxMessagesForExport(p: {
  packageId?: string
  bossView: boolean
  role: string
  pageSize?: number
}): Promise<Message[]> {
  const pageSize = Math.min(500, Math.max(1, p.pageSize ?? 100))
  const useBoss = p.role === 'boss' && p.bossView
  let offset = 0
  const all: InboxApiRow[] = []
  for (;;) {
    if (shouldSkipMessengerApiRelayFallback() && !useBoss) {
      const page = await fetchMailboxInboxPage({
        limit: pageSize,
        offset,
        packageId: p.packageId,
      })
      if (!page.ok || page.rows.length === 0) break
      all.push(...page.rows)
      if (page.rows.length < pageSize) break
      offset += page.rows.length
      continue
    }
    const res = await fetchInbox(pageSize, undefined, p.packageId, useBoss, offset)
    const raw = pickInboxRawMessages(res as { data?: unknown; messages?: unknown })
    if (!res.ok || raw == null || raw.length === 0) break
    all.push(...(raw as InboxApiRow[]))
    if (raw.length < pageSize) break
    offset += raw.length
  }
  return mapInboxApiRowsToMessages(all)
}
