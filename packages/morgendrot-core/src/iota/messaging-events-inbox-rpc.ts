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

function maxEventPagesForInbox(limit: number): number {
  if (limit >= 200) return 15
  if (limit >= 80) return 8
  return 4
}

type ParsedEvent = {
  type?: string
  id?: unknown
  timestampMs?: bigint | number
  parsedJson?: Record<string, unknown>
}

/**
 * Move-Events `EncryptedMessage` + `PlaintextMessage` für Posteingang-Union (ohne DOF).
 */
export async function fetchMessagingEventInboxRpcRows(
  client: IotaClient,
  input: FetchMessagingEventInboxRpcInput
): Promise<MessagingEventInboxRpcRow[]> {
  const pkg = input.packageId.trim()
  const me = normalizeMailboxAddress(input.myAddress)
  if (!MAILBOX_INBOX_HEX64.test(pkg) || !MAILBOX_INBOX_HEX64.test(me)) return []

  const limit = Math.max(1, Math.min(500, input.limit))
  const offset = Math.max(0, input.offset)
  const maxPages = Math.min(20, Math.max(1, input.maxEventPages ?? maxEventPagesForInbox(limit + offset)))

  const eventQuery = { MoveModule: { package: pkg, module: 'messaging' } }
  const allEventData: ParsedEvent[] = []
  let eventCursor: string | null | undefined = undefined

  for (let p = 0; p < maxPages; p++) {
    const events = (await client.queryEvents({
      query: eventQuery,
      limit: 1000,
      order: 'descending',
      ...(eventCursor != null ? { cursor: eventCursor } : {}),
    } as Parameters<IotaClient['queryEvents']>[0])) as { data?: ParsedEvent[]; nextCursor?: string | null }
    const data = events.data ?? []
    allEventData.push(...data)
    const next = events.nextCursor
    if (next == null || next === eventCursor) break
    eventCursor = next
  }

  const keySeen = new Set<string>()
  const items: Array<MessagingEventInboxRpcRow & { sortTs: number }> = []

  const pushRow = (row: MessagingEventInboxRpcRow & { sortTs: number }) => {
    if (keySeen.has(row.inboxKey)) return
    keySeen.add(row.inboxKey)
    items.push(row)
  }

  for (const msg of allEventData) {
    const t = msg.type ?? ''
    const d = msg.parsedJson ?? {}
    const sender = String(d.sender ?? '').trim()
    const recipient = String(d.recipient ?? '').trim()
    if (!sender.startsWith('0x') || !recipient.startsWith('0x')) continue
    const involvesMe =
      normalizeMailboxAddress(recipient) === me || normalizeMailboxAddress(sender) === me
    if (!involvesMe) continue

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
      if (ivBytes.length < 12 || cipherBytes.length === 0 || tagBytes.length !== 16) continue
      pushRow({
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
      })
      continue
    }

    if (t.endsWith('::messaging::PlaintextMessage')) {
      const text = decodePlaintext(coerceEventBytes(d.text))
      pushRow({
        kind: 'plain',
        sender,
        recipient,
        text,
        nonce,
        tsMs,
        inboxKey,
        sortTs: tsMs,
      })
    }
  }

  items.sort((a, b) => b.sortTs - a.sortTs || (a.nonce < b.nonce ? 1 : -1))
  const page = items.slice(offset, offset + limit)
  return page.map(({ sortTs: _s, ...row }) => row)
}
