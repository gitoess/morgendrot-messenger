import type { Message } from '../types'
import { mapInboxApiRowsToMessages, type InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { pickInboxRawMessages, pickInboxHasMore } from '@/frontend/lib/inbox-pick-raw-messages'
import { executeCommand } from '@/frontend/lib/api/execute-command'

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

/**
 * Eine Mailbox (Shared = ohne objectId, oder private) vollständig paginiert.
 * Wichtig: private Mailboxen brauchen eigenen Offset — der Union-Fetch setzt bei privaten immer 0.
 */
async function fetchAllPagesFromOneMailbox(p: {
  pageSize: number
  packageId?: string
  mailboxObjectId?: string
  mergeLocalInbox?: boolean
}): Promise<Message[]> {
  const { mergeAllMessages } = await import('@/frontend/lib/message-dedup')
  const { tryFetchDirectMailboxInboxViaIota } = await import('@/frontend/lib/direct-iota-inbox-fetch')
  const { stampChainMailboxObjectId } = await import('@/frontend/features/inbox/inbox-map-messages')

  let offset = 0
  let acc: Message[] = []
  let guard = 0

  for (;;) {
    let pageMsgs: Message[] = []
    let pageLen = 0
    let hasMore = false

    const direct = await tryFetchDirectMailboxInboxViaIota({
      limit: p.pageSize,
      offset,
      packageIdOverride: p.packageId,
      mailboxObjectId: p.mailboxObjectId,
    })
    if (direct.ok && direct.rows.length > 0) {
      pageMsgs = mapInboxApiRowsToMessages(direct.rows as InboxApiRow[])
      pageLen = direct.rows.length
      hasMore = pageLen >= p.pageSize
    } else {
      const res = await fetchInbox(
        p.pageSize,
        undefined,
        p.packageId,
        false,
        offset,
        Boolean(p.mergeLocalInbox && !p.mailboxObjectId),
        p.mailboxObjectId,
        true
      )
      const raw = pickInboxRawMessages(res as { data?: unknown; messages?: unknown })
      if (!res.ok || raw == null || raw.length === 0) break
      pageMsgs = mapInboxApiRowsToMessages(raw as InboxApiRow[])
      pageLen = raw.length
      hasMore = pickInboxHasMore(res as { hasMore?: unknown }) || pageLen >= p.pageSize
    }

    if (p.mailboxObjectId) {
      pageMsgs = stampChainMailboxObjectId(pageMsgs, p.mailboxObjectId)
    }

    if (pageMsgs.length === 0) break
    const before = acc.length
    acc = mergeAllMessages([...acc, ...pageMsgs])
    if (acc.length <= before && offset > 0) break
    if (!hasMore || pageLen < p.pageSize) break
    offset += pageLen
    if (++guard > 250 || offset > 50_000) break
  }
  return acc
}

/** Alle Posteingangs-Nachrichten (paginiert, Shared + jede private Mailbox separat) – für Exporte. */
export async function fetchAllInboxMessagesForExport(p: {
  packageId?: string
  bossView: boolean
  role: string
  pageSize?: number
}): Promise<Message[]> {
  const pageSize = Math.min(500, Math.max(1, p.pageSize ?? 200))
  const useBoss = p.role === 'boss' && p.bossView

  if (useBoss) {
    let offset = 0
    const all: InboxApiRow[] = []
    for (;;) {
      const res = await fetchInbox(pageSize, undefined, p.packageId, true, offset)
      const raw = pickInboxRawMessages(res as { data?: unknown; messages?: unknown })
      if (!res.ok || raw == null || raw.length === 0) break
      all.push(...(raw as InboxApiRow[]))
      if (raw.length < pageSize) break
      offset += raw.length
      if (offset > 50_000) break
    }
    return mapInboxApiRowsToMessages(all)
  }

  const { mergeAllMessages } = await import('@/frontend/lib/message-dedup')
  const { readMyPrivateMailboxes } = await import('@/frontend/lib/my-private-mailbox-store')
  const { readActiveSendMailboxObjectId } = await import('@/frontend/lib/my-mailbox-active')

  const mailboxIds: string[] = []
  const seen = new Set<string>()
  const pushMb = (raw: string) => {
    const id = raw.trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(id) || seen.has(id)) return
    seen.add(id)
    mailboxIds.push(id)
  }
  pushMb(readActiveSendMailboxObjectId())
  for (const m of readMyPrivateMailboxes()) pushMb(m.objectId)

  /** Shared/Server-Union (Events + Default-Mailbox). */
  const shared = await fetchAllPagesFromOneMailbox({
    pageSize,
    packageId: p.packageId,
    mergeLocalInbox: true,
  })

  const privateChunks: Message[][] = []
  for (const mb of mailboxIds) {
    privateChunks.push(
      await fetchAllPagesFromOneMailbox({
        pageSize,
        packageId: p.packageId,
        mailboxObjectId: mb,
      })
    )
  }

  return mergeAllMessages([shared, ...privateChunks.flat()])
}
