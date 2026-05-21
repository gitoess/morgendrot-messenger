/**
 * Posteingang: Shared (Server, immer) + optional die für Senden aktive private Mailbox (M4d).
 */
import { fetchInbox } from '@/frontend/lib/api/inbox'
import {
  mapInboxApiRowsToMessages,
  pickInboxRawMessages,
  type InboxApiRow,
} from '@/frontend/features/inbox/inbox-map-messages'
import { pickInboxHasMore } from '@/frontend/lib/inbox-pick-raw-messages'
import { mergeAllMessages } from '@/frontend/lib/message-dedup'
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
import type { Message } from '@/frontend/lib/types'

export type FetchInboxUnionResult = {
  ok: boolean
  messages: Message[]
  error?: string
  /** Stride für Pagination (nur Shared-Mailbox-Seite). */
  stride: number
  /** Server-/inbox-Fetch: weitere Zeilen auf der Chain. */
  hasMore: boolean
}

/** Aktive Team- oder Private-Mailbox (Send + Posteingang-Fokus). */
function activeSendMailboxIdForInbox(): string {
  return readActiveSendMailboxObjectId()
}

function isMailboxId(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(id.trim())
}

/** Shared + aktive private Mailbox; Events deduplizieren sich per mergeAllMessages. */
export async function fetchInboxFromAllOwnedMailboxes(p: {
  limit: number
  offset: number
  packageId?: string
  mergeLocalInbox?: boolean
  /** Server-MAILBOX_ID aus /api/status — explizit statt nur Backend-Default. */
  serverMailboxId?: string
  /** Nur bei Aktualisieren/Erster Load — Auto-Poll nur Shared (+ optional `alsoMailboxIds`). */
  includePrivateMailboxes?: boolean
  /** Zusätzliche Mailbox-IDs (z. B. aktive private bei Auto-Poll). */
  alsoMailboxIds?: string[]
  /** Kein INFO-Log „Letzte N geladen“ auf dem API-Server. */
  silent?: boolean
}): Promise<FetchInboxUnionResult> {
  const mergedIds: string[] = []
  const seen = new Set<string>()
  const pushId = (raw: string) => {
    const id = raw.trim()
    const k = id.toLowerCase()
    if (!isMailboxId(id) || seen.has(k)) return
    seen.add(k)
    mergedIds.push(id)
  }
  if (p.includePrivateMailboxes !== false) {
    pushId(activeSendMailboxIdForInbox())
  }
  for (const raw of p.alsoMailboxIds ?? []) pushId(raw)
  /** Erster Fetch ohne mailboxObjectId → Backend-Union (alle MsgKeys + Events). */
  const fetchSeen = new Set<string>()
  const sources: (string | undefined)[] = [undefined]
  fetchSeen.add('__server__')
  for (const id of mergedIds) {
    const k = id.toLowerCase()
    if (fetchSeen.has(k)) continue
    fetchSeen.add(k)
    sources.push(id)
  }

  let anyOk = false
  let lastError: string | undefined
  let serverStride = 0
  let serverHasMore = false
  const mappedChunks: Message[] = []

  for (let i = 0; i < sources.length; i++) {
    const mailboxObjectId = sources[i]
    const isServer = mailboxObjectId == null
    const res = await fetchInbox(
      p.limit,
      undefined,
      p.packageId,
      false,
      isServer ? p.offset : 0,
      Boolean(p.mergeLocalInbox && isServer),
      mailboxObjectId,
      p.silent === true
    )
    const resLoose = res as {
      data?: unknown
      messages?: unknown
      ok?: boolean
      error?: string
      message?: string
      hasMore?: unknown
    }
    const raw = pickInboxRawMessages(resLoose)
    const resHasMore = pickInboxHasMore(resLoose)
    if (res.ok && raw != null) {
      anyOk = true
      const mapped = mapInboxApiRowsToMessages(raw as InboxApiRow[])
      if (isServer) {
        serverStride = mapped.length
        serverHasMore = resHasMore
      }
      mappedChunks.push(...mapped)
    } else if (!res.ok) {
      lastError = resLoose.error || resLoose.message || lastError
    }
  }

  if (!anyOk) {
    return {
      ok: false,
      messages: [],
      error: lastError || 'Posteingang konnte nicht geladen werden.',
      stride: 0,
      hasMore: false,
    }
  }

  return {
    ok: true,
    messages: mergeAllMessages(mappedChunks),
    stride: serverStride,
    hasMore: serverHasMore,
  }
}
