import type { Message } from '../types'
import { mapInboxApiRowsToMessages, type InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { pickInboxRawMessages, pickInboxHasMore } from '@/frontend/lib/inbox-pick-raw-messages'
import { executeCommand } from '@/frontend/lib/api/execute-command'
import { getDirectChainFieldIdsFromLs } from '@/frontend/lib/direct-iota-chain-context'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { unwrapRatchetV3InInboxApiRows } from '@/frontend/lib/ratchet-after-outer-decrypt'

function inboxMyAddressForRatchet(): string {
  return (
    getDirectIotaSessionSignerAddress()?.trim() ||
    getDirectChainFieldIdsFromLs().senderAddress.trim() ||
    ''
  )
}

/** limit, optional senderFilter (0x…), optional packageId, optional bossView, optional offset (ältere Seiten). */
const INBOX_FETCH_TIMEOUT_MS = 45_000
/** Export: ein großer Indexer-Scan darf länger dauern als UI-Poll. */
const INBOX_EXPORT_TIMEOUT_MS = 180_000

export const fetchInbox = (
  limit = 20,
  senderFilter?: string,
  packageId?: string,
  bossView?: boolean,
  offset = 0,
  mergeLocalInbox = false,
  mailboxObjectId?: string,
  silentFetch?: boolean,
  mailboxKeysOnly?: boolean,
  timeoutMs?: number
) =>
  executeCommand<Message[]>(
    '/inbox',
    bossView
      ? [String(limit), senderFilter ?? '', packageId ?? '', 'boss', mergeLocalInbox ? 'true' : '', String(offset)]
      : [String(limit), senderFilter ?? '', packageId ?? '', '', mergeLocalInbox ? 'true' : '', String(offset)],
    {
      timeoutMs: timeoutMs ?? INBOX_FETCH_TIMEOUT_MS,
      mailboxObjectId,
      silentFetch,
      mailboxKeysOnly,
    }
  )

export type FetchAllPagesFromOneMailboxOpts = {
  pageSize: number
  packageId?: string
  mailboxObjectId?: string
  mergeLocalInbox?: boolean
  /**
   * Direct-RPC nur auf der ersten Seite (Export).
   * Sonst Indexer-Scan × jede Seite → Minuten-Hang.
   */
  directOnlyFirstPage?: boolean
  /** Private/Team: nur MsgKeys, keine Event-Union (Events kommen von Shared). */
  mailboxKeysOnly?: boolean
  /** Längerer Timeout (Export-One-Shot). */
  timeoutMs?: number
}

/**
 * Eine Mailbox (Shared = ohne objectId, oder private/team) vollständig paginiert.
 * API + Direkt-RPC werden **gemerged** (wie UI) — nicht XOR.
 * Direct standardmäßig nur bei offset=0 (sonst O(n²) Indexer-Rescans).
 */
export async function fetchAllPagesFromOneMailbox(p: FetchAllPagesFromOneMailboxOpts): Promise<Message[]> {
  const { mergeAllMessages } = await import('@/frontend/lib/message-dedup')
  const { tryFetchDirectMailboxInboxViaIota } = await import('@/frontend/lib/direct-iota-inbox-fetch')
  const { stampChainMailboxObjectId } = await import('@/frontend/features/inbox/inbox-map-messages')
  const { shouldSkipMessengerApiRelayFallback } = await import('@/frontend/lib/messenger-standalone-relay')

  let offset = 0
  let acc: Message[] = []
  let guard = 0
  const skipApi = shouldSkipMessengerApiRelayFallback()
  const isShared = !p.mailboxObjectId
  const directOnlyFirst = p.directOnlyFirstPage !== false
  const timeoutMs = p.timeoutMs

  for (;;) {
    const pageChunks: Message[] = []
    let apiStride = 0
    let apiHasMore = false
    let directLen = 0

    if (!skipApi) {
      const res = await fetchInbox(
        p.pageSize,
        undefined,
        p.packageId,
        false,
        offset,
        Boolean(p.mergeLocalInbox && isShared),
        p.mailboxObjectId,
        true,
        p.mailboxKeysOnly === true,
        timeoutMs
      )
      const raw = pickInboxRawMessages(res as { data?: unknown; messages?: unknown })
      if (res.ok && raw != null && raw.length > 0) {
        const unwrapped = await unwrapRatchetV3InInboxApiRows(
          raw as InboxApiRow[],
          inboxMyAddressForRatchet()
        )
        let mapped = mapInboxApiRowsToMessages(unwrapped)
        if (p.mailboxObjectId) mapped = stampChainMailboxObjectId(mapped, p.mailboxObjectId)
        pageChunks.push(...mapped)
        apiStride = raw.length
        apiHasMore = pickInboxHasMore(res as { hasMore?: unknown }) || raw.length >= p.pageSize
      }
    }

    const runDirect = !directOnlyFirst || offset === 0
    if (runDirect) {
      const direct = await tryFetchDirectMailboxInboxViaIota({
        limit: p.pageSize,
        offset,
        mailboxObjectId: p.mailboxObjectId,
        includeMessagingEvents: isShared,
      })
      if (direct.ok && direct.rows.length > 0) {
        let mapped = mapInboxApiRowsToMessages(direct.rows as InboxApiRow[])
        if (p.mailboxObjectId) mapped = stampChainMailboxObjectId(mapped, p.mailboxObjectId)
        pageChunks.push(...mapped)
        directLen = direct.rows.length
        if (skipApi) {
          apiStride = directLen
          apiHasMore = direct.hasMore === true || directLen >= p.pageSize
        } else if (direct.hasMore === true || directLen >= p.pageSize) {
          apiHasMore = true
        }
      }
    }

    if (pageChunks.length === 0) break

    const before = acc.length
    acc = mergeAllMessages([...acc, ...pageChunks])
    const stride = apiStride > 0 ? apiStride : directLen
    if (stride <= 0) break
    if (!apiHasMore) break
    if (acc.length <= before && offset > 0) break

    offset += stride
    if (++guard > 250 || offset > 50_000) break
  }
  return acc
}

/** Alle Posteingangs-Nachrichten (paginiert, Shared + private + Team) – für Exporte. */
export async function fetchAllInboxMessagesForExport(p: {
  packageId?: string
  bossView: boolean
  role: string
  pageSize?: number
}): Promise<Message[]> {
  /**
   * Ein großer First-Shot (Indexer einmal), danach nur API-Append ohne Direct.
   * Früher: pageSize 200–500 × (API+Direct) × Mailboxen → Export hing Minuten.
   */
  const pageSize = Math.min(5_000, Math.max(500, p.pageSize ?? 2_000))
  const useBoss = p.role === 'boss' && p.bossView

  if (useBoss) {
    let offset = 0
    const all: InboxApiRow[] = []
    for (;;) {
      const res = await fetchInbox(
        pageSize,
        undefined,
        p.packageId,
        true,
        offset,
        false,
        undefined,
        true,
        false,
        INBOX_EXPORT_TIMEOUT_MS
      )
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
  const { collectInboxAlsoMailboxIds } = await import('@/frontend/lib/inbox-also-mailbox-ids')

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
  for (const id of collectInboxAlsoMailboxIds()) pushMb(id)

  /** Shared: Events + Default-Mailbox (Direct nur Seite 0). */
  const shared = await fetchAllPagesFromOneMailbox({
    pageSize,
    packageId: p.packageId,
    mergeLocalInbox: true,
    directOnlyFirstPage: true,
    timeoutMs: INBOX_EXPORT_TIMEOUT_MS,
  })

  /** Private/Team parallel: nur Keys — Event-Union steckt schon in Shared. */
  const privateChunks = await Promise.all(
    mailboxIds.map((mb) =>
      fetchAllPagesFromOneMailbox({
        pageSize,
        packageId: p.packageId,
        mailboxObjectId: mb,
        directOnlyFirstPage: true,
        mailboxKeysOnly: true,
        timeoutMs: INBOX_EXPORT_TIMEOUT_MS,
      })
    )
  )

  return mergeAllMessages([...shared, ...privateChunks.flat()])
}
