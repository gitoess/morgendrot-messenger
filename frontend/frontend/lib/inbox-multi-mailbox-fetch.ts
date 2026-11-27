/**
 * Posteingang: Shared (Server, immer) + optional die für Senden aktive private Mailbox (M4d).
 */
import { fetchInbox } from '@/frontend/lib/api/inbox'
import {
  mapInboxApiRowsToMessages,
  pickInboxRawMessages,
  stampChainMailboxObjectId,
  type InboxApiRow,
} from '@/frontend/features/inbox/inbox-map-messages'
import { tryFetchDirectMailboxInboxViaIota } from '@/frontend/lib/direct-iota-inbox-fetch'
import { getDirectChainFieldIdsFromLs } from '@/frontend/lib/direct-iota-chain-context'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { pickInboxHasMore } from '@/frontend/lib/inbox-pick-raw-messages'
import { shouldSkipMessengerApiRelayFallback } from '@/frontend/lib/messenger-standalone-relay'
import { mergeAllMessages } from '@/frontend/lib/message-dedup'
import { readActiveSendMailboxObjectId } from '@/frontend/lib/my-mailbox-active'
import { readMyPrivateMailboxes } from '@/frontend/lib/my-private-mailbox-store'
import { unwrapRatchetV3InInboxApiRows } from '@/frontend/lib/ratchet-after-outer-decrypt'
import type { Message } from '@/frontend/lib/types'

function inboxMyAddressForRatchet(): string {
  return (
    getDirectIotaSessionSignerAddress()?.trim() ||
    getDirectChainFieldIdsFromLs().senderAddress.trim() ||
    ''
  )
}

export type FetchInboxUnionResult = {
  ok: boolean
  messages: Message[]
  error?: string
  /** Stride für Pagination (nur Shared-Mailbox-Seite). */
  stride: number
  /** Server-/inbox-Fetch: weitere Zeilen auf der Chain. */
  hasMore: boolean
  /** Mindestens ein Mailbox-Chunk kam von Direkt-RPC (ohne /inbox). */
  loadedViaRpc?: boolean
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
    /** Alle lokalen privaten Mailboxen — nicht nur die aktive (sonst fehlen ältere Threads). */
    for (const m of readMyPrivateMailboxes()) pushId(m.objectId)
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
  let loadedViaRpc = false
  let lastError: string | undefined
  let serverStride = 0
  let serverHasMore = false
  const mappedChunks: Message[] = []

  for (let i = 0; i < sources.length; i++) {
    const mailboxObjectId = sources[i]
    const isServer = mailboxObjectId == null
    const skipApiRelay = shouldSkipMessengerApiRelayFallback()

    const fetchApiChunk = async (): Promise<boolean> => {
      if (skipApiRelay) return false
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
        const unwrapped = await unwrapRatchetV3InInboxApiRows(
          raw as InboxApiRow[],
          inboxMyAddressForRatchet()
        )
        let mapped = mapInboxApiRowsToMessages(unwrapped)
        const stampMb = mailboxObjectId || p.serverMailboxId
        if (stampMb) mapped = stampChainMailboxObjectId(mapped, stampMb)
        if (isServer) {
          serverStride = mapped.length
          /** API-Flag oder volle Shared-Seite (Hook stoppt per Novel-Count, nicht per Ghost-Klick). */
          serverHasMore = resHasMore || raw.length >= p.limit
        }
        mappedChunks.push(...mapped)
        return true
      }
      if (!res.ok) lastError = resLoose.error || resLoose.message || lastError
      return false
    }

    /** Shared: API zuerst (Event-Union über alle Package-IDs), Direkt-RPC ergänzt. */
    if (isServer && !skipApiRelay) {
      await fetchApiChunk()
    }

    /** Ohne packageIdOverride — Snapshot-Package; Indexer ergänzt Event-Historie. */
    const direct = await tryFetchDirectMailboxInboxViaIota({
      limit: p.limit,
      offset: isServer ? p.offset : 0,
      mailboxObjectId: isServer ? undefined : mailboxObjectId,
    })
    if (direct.ok) {
      anyOk = true
      loadedViaRpc = true
      let mapped = mapInboxApiRowsToMessages(direct.rows as InboxApiRow[])
      const stampMb = mailboxObjectId || p.serverMailboxId
      if (stampMb) mapped = stampChainMailboxObjectId(mapped, stampMb)
      if (isServer) {
        /** Direkt oft tiefer als kurzes API-hasMore:false — Stride/hasMore nicht nur an API hängen. */
        if (skipApiRelay || mapped.length > serverStride) {
          serverStride = Math.max(serverStride, mapped.length)
        }
        if (mapped.length >= p.limit || direct.hasMore === true) serverHasMore = true
      }
      mappedChunks.push(...mapped)
      if (!isServer) continue
    } else if (isServer) {
      lastError = direct.error || lastError
    }

    if (skipApiRelay) continue
    if (!isServer && direct.ok) continue
    if (isServer) continue

    await fetchApiChunk()
  }

  if (!anyOk) {
    return {
      ok: false,
      messages: [],
      error: lastError || 'Posteingang konnte nicht geladen werden.',
      stride: 0,
      hasMore: false,
      loadedViaRpc: false,
    }
  }

  const merged = mergeAllMessages(mappedChunks)

  return {
    ok: true,
    messages: merged,
    /** Shared-Stride; hasMore auch wenn gemergte Seite voll (API kurz, Direkt voll). */
    stride: serverStride > 0 ? serverStride : Math.min(merged.length, p.limit),
    hasMore: serverHasMore || merged.length >= p.limit,
    loadedViaRpc,
  }
}
