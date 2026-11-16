import type { IotaClient } from '@iota/iota-sdk/client'
import { MAILBOX_INBOX_HEX64, coerceMoveU8Vector, normalizeMailboxAddress } from './mailbox-inbox-rpc-helpers'

export type MessagingEventInboxPlainRow = {
  kind: 'plain'
  sender: string
  recipient: string
  text: string
  nonce: bigint
  tsMs: number
  inboxKey: string
}

export type MessagingEventInboxEncryptedRow = {
  kind: 'encrypted'
  sender: string
  recipient: string
  iv: Uint8Array
  ciphertext: Uint8Array
  tag: Uint8Array
  nonce: bigint
  tsMs: number
  inboxKey: string
}

export type MessagingEventInboxRpcRow =
  | MessagingEventInboxPlainRow
  | MessagingEventInboxEncryptedRow

export type FetchMessagingEventInboxRpcInput = {
  packageId: string
  myAddress: string
  limit: number
  offset: number
  maxEventPages?: number
}

function coerceEventBytes(val: unknown): Uint8Array {
  if (val == null) return new Uint8Array(0)
  if (val instanceof Uint8Array) return val
  if (Array.isArray(val)) return coerceMoveU8Vector(val)
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s) return new Uint8Array(0)
    if (/^0x[0-9a-fA-F]+$/.test(s)) {
      const hex = s.slice(2)
      const out = new Uint8Array(hex.length / 2)
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
      return out
    }
    try {
      const bin = atob(s)
      const out = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      return out
    } catch {
      return new TextEncoder().encode(s)
    }
  }
  return new Uint8Array(0)
}

function decodePlaintext(bytes: Uint8Array): string {
  if (!bytes.length) return ''
  try {
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

function resolveEventTsMs(tsMs: number | undefined, nonce: bigint): number {
  if (tsMs != null && Number.isFinite(tsMs) && tsMs > 0) return tsMs
  const n = Number(nonce)
  if (Number.isFinite(n) && n >= 1_000_000_000_000) return n
  return 0
}

function eventStableId(msg: { id?: unknown }): string {
  const id = msg.id
  if (id == null) return ''
  if (typeof id === 'string') return id.trim()
  try {
    return JSON.stringify(id)
  } catch {
    return String(id)
  }
}

function inboxDedupKey(parts: {
  eventId?: string
  channel: 'ev' | 'plain'
  sender: string
  recipient: string
  nonce: bigint
  tsMs: number
}): string {
  const eid = (parts.eventId ?? '').trim()
  if (eid) return `evid:${eid}`
  return `${parts.channel}:${normalizeMailboxAddress(parts.sender)}:${normalizeMailboxAddress(parts.recipient)}:${String(parts.nonce)}:${parts.tsMs}`
}

/** Fallback, wenn Caller kein maxEventPages setzt. */
function maxEventPagesForInbox(need: number): number {
  if (need >= 500) return 80
  if (need >= 200) return 50
  if (need >= 80) return 30
  return 20
}

type ParsedEvent = {
  type?: string
  id?: unknown
  timestampMs?: bigint | number
  parsedJson?: Record<string, unknown>
}

function parseMessagingEventRow(
  msg: ParsedEvent,
  me: string
): (MessagingEventInboxRpcRow & { sortTs: number }) | null {
  const t = msg.type ?? ''
  const d = msg.parsedJson ?? {}
  const sender = String(d.sender ?? '').trim()
  const recipient = String(d.recipient ?? '').trim()
  if (!sender.startsWith('0x') || !recipient.startsWith('0x')) return null
  const involvesMe =
    normalizeMailboxAddress(recipient) === me || normalizeMailboxAddress(sender) === me
  if (!involvesMe) return null

  const tRaw = msg.timestampMs
  const tsRaw =
    typeof tRaw === 'bigint' ? Number(tRaw) : typeof tRaw === 'number' ? tRaw : undefined
  const nonce = BigInt(String(d.nonce ?? 0))
  const tsMs = resolveEventTsMs(tsRaw, nonce)
  const inboxKey = inboxDedupKey({
    eventId: eventStableId(msg),
    channel: t.endsWith('::messaging::PlaintextMessage') ? 'plain' : 'ev',
    sender,
    recipient,
    nonce,
    tsMs,
  })

  if (t.endsWith('::messaging::EncryptedMessage')) {
    const ivBytes = coerceEventBytes(d.iv)
    const cipherBytes = coerceEventBytes(d.ciphertext)
    const tagBytes = coerceEventBytes(d.tag)
    if (ivBytes.length < 12 || cipherBytes.length === 0 || tagBytes.length !== 16) return null
    return {
      kind: 'encrypted',
      sender,
      recipient,
      iv: ivBytes,
      ciphertext: cipherBytes,
      tag: tagBytes,
      nonce,
      tsMs,
      inboxKey,
      sortTs: tsMs,
    }
  }

  if (t.endsWith('::messaging::PlaintextMessage')) {
    const text = decodePlaintext(coerceEventBytes(d.text))
    return {
      kind: 'plain',
      sender,
      recipient,
      text,
      nonce,
      tsMs,
      inboxKey,
      sortTs: tsMs,
    }
  }
  return null
}

/**
 * Move-Events `EncryptedMessage` + `PlaintextMessage` für Posteingang-Union (ohne DOF).
 *
 * Wichtig: Package-Events sind global. Fremde Traffic füllt queryEvents-Seiten —
 * daher weiter blättern, bis genug **eigene** Treffer da sind (oder Chain/Ende).
 */
export async function fetchMessagingEventInboxRpcRows(
  client: IotaClient,
  input: FetchMessagingEventInboxRpcInput
): Promise<MessagingEventInboxRpcRow[]> {
  const pkg = input.packageId.trim()
  const me = normalizeMailboxAddress(input.myAddress)
  if (!MAILBOX_INBOX_HEX64.test(pkg) || !MAILBOX_INBOX_HEX64.test(me)) return []

  const limit = Math.max(1, Math.min(10_000, input.limit))
  const offset = Math.max(0, input.offset)
  const need = offset + limit
  const maxPages = Math.min(200, Math.max(1, input.maxEventPages ?? maxEventPagesForInbox(need)))

  const eventQuery = { MoveModule: { package: pkg, module: 'messaging' } }
  const keySeen = new Set<string>()
  const items: Array<MessagingEventInboxRpcRow & { sortTs: number }> = []

  const pushRow = (row: MessagingEventInboxRpcRow & { sortTs: number }) => {
    if (keySeen.has(row.inboxKey)) return
    keySeen.add(row.inboxKey)
    items.push(row)
  }

  let eventCursor: string | null | undefined = undefined
  for (let p = 0; p < maxPages; p++) {
    const events = (await client.queryEvents({
      query: eventQuery,
      limit: 1000,
      order: 'descending',
      ...(eventCursor != null ? { cursor: eventCursor } : {}),
    } as Parameters<IotaClient['queryEvents']>[0])) as {
      data?: ParsedEvent[]
      nextCursor?: string | null
      hasNextPage?: boolean
    }
    const data = events.data ?? []
    if (data.length === 0) break
    for (const msg of data) {
      const row = parseMessagingEventRow(msg, me)
      if (row) pushRow(row)
    }
    /** Neueste zuerst: sobald genug eigene Treffer → fertig. */
    if (items.length >= need) break
    const next = events.nextCursor
    if (next == null || next === eventCursor) break
    if (events.hasNextPage === false) break
    eventCursor = next
  }

  items.sort((a, b) => b.sortTs - a.sortTs || (a.nonce < b.nonce ? 1 : -1))
  const page = items.slice(offset, offset + limit)
  return page.map(({ sortTs: _s, ...row }) => row)
}

export type FetchMessagingEventInboxViaAddressTxsInput = {
  myAddress: string
  limit: number
  offset?: number
  /** TX-Seiten (à ~50). Default skaliert mit need. */
  maxTxPages?: number
  /** Gefundene Messaging-Package-IDs (Nebenprodukt für History). */
  discoveredPackageIds?: Set<string>
}

/**
 * Wie IOTA-Explorer Activity: `FromOrToAddress` + Events aus den TXs.
 * Braucht Indexer-RPC (`indexer.*.iota.cafe`) — Fullnode `api.*` kennt den Filter oft nicht.
 * Decängt Lücken, wenn `queryEvents` pro Package gepruned ist, TXs aber noch indexiert sind.
 */
export async function fetchMessagingEventInboxViaAddressTxs(
  client: IotaClient,
  input: FetchMessagingEventInboxViaAddressTxsInput
): Promise<MessagingEventInboxRpcRow[]> {
  const me = normalizeMailboxAddress(input.myAddress)
  if (!MAILBOX_INBOX_HEX64.test(me)) return []

  const limit = Math.max(1, Math.min(10_000, input.limit))
  const offset = Math.max(0, Math.floor(input.offset ?? 0))
  const need = offset + limit
  const maxPages = Math.min(
    120,
    Math.max(1, input.maxTxPages ?? Math.min(80, Math.max(20, Math.ceil(need / 8) + 15)))
  )

  const keySeen = new Set<string>()
  const items: Array<MessagingEventInboxRpcRow & { sortTs: number }> = []
  const pushRow = (row: MessagingEventInboxRpcRow & { sortTs: number }) => {
    if (keySeen.has(row.inboxKey)) return
    keySeen.add(row.inboxKey)
    items.push(row)
  }

  let cursor: string | null | undefined
  for (let p = 0; p < maxPages; p++) {
    let page: {
      data?: Array<{ events?: ParsedEvent[]; timestampMs?: string | number | null }>
      nextCursor?: string | null
      hasNextPage?: boolean
    }
    try {
      page = (await client.queryTransactionBlocks({
        filter: { FromOrToAddress: { addr: me } } as never,
        options: { showEvents: true },
        limit: 50,
        order: 'descending',
        ...(cursor ? { cursor } : {}),
      })) as typeof page
    } catch {
      /** Fullnode ohne FromOrToAddress → leere Ergänzung, kein Hard-Fail. */
      break
    }
    const data = page.data ?? []
    if (data.length === 0) break
    for (const tx of data) {
      const txTs = tx.timestampMs != null ? Number(tx.timestampMs) : undefined
      for (const ev of tx.events ?? []) {
        const t = String(ev.type ?? '')
        if (!/::messaging::(Plaintext|Encrypted)Message$/.test(t)) continue
        const pkg = t.split('::')[0]
        if (pkg && input.discoveredPackageIds && MAILBOX_INBOX_HEX64.test(pkg)) {
          input.discoveredPackageIds.add(pkg.toLowerCase())
        }
        const withTs: ParsedEvent =
          ev.timestampMs != null
            ? ev
            : { ...ev, timestampMs: Number.isFinite(txTs) ? txTs : undefined }
        const row = parseMessagingEventRow(withTs, me)
        if (row) pushRow(row)
      }
    }
    if (items.length >= need) break
    if (page.hasNextPage !== true || !page.nextCursor || page.nextCursor === cursor) break
    cursor = page.nextCursor
  }

  items.sort((a, b) => b.sortTs - a.sortTs || (a.nonce < b.nonce ? 1 : -1))
  return items.slice(offset, offset + limit).map(({ sortTs: _s, ...row }) => row)
}
