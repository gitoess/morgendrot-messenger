import type { Message } from '../types'
import { mapInboxApiRowsToMessages, type InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { pickInboxRawMessages } from '@/frontend/lib/inbox-pick-raw-messages'
import { executeCommand } from '@/frontend/lib/api/execute-command'

/** limit, optional senderFilter (0x…), optional packageId, optional bossView, optional offset (ältere Seiten). */
export const fetchInbox = (
  limit = 20,
  senderFilter?: string,
  packageId?: string,
  bossView?: boolean,
  offset = 0
) =>
  executeCommand<Message[]>('/inbox', bossView
    ? [String(limit), senderFilter ?? '', packageId ?? '', 'boss', '', String(offset)]
    : [String(limit), senderFilter ?? '', packageId ?? '', '', '', String(offset)])

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
    const res = await fetchInbox(pageSize, undefined, p.packageId, useBoss, offset)
    const raw = pickInboxRawMessages(res as { data?: unknown; messages?: unknown })
    if (!res.ok || raw == null || raw.length === 0) break
    all.push(...(raw as InboxApiRow[]))
    if (raw.length < pageSize) break
    offset += raw.length
  }
  return mapInboxApiRowsToMessages(all)
}
