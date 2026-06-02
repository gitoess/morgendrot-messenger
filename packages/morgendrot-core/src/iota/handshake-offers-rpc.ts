import type { IotaClient } from '@iota/iota-sdk/client'
import {
  coerceMoveU8Vector,
  MAILBOX_INBOX_HEX64,
  messagingStructType,
  normalizeMailboxAddress,
} from './mailbox-inbox-rpc-helpers'

export type HandshakeOfferSource = 'mailbox' | 'event'

export type IncomingHandshakeOfferRpc = {
  sender: string
  nonce: string
  source: HandshakeOfferSource
}

export type OutgoingHandshakeOfferRpc = {
  recipient: string
  nonce: string
  source: HandshakeOfferSource
}

export type ListHandshakeOffersRpcInput = {
  packageId: string
  myAddress: string
  mailboxObjectIds: string[]
  limit?: number
  maxDynamicFieldPages?: number
  eventLimit?: number
}

export type FindPeerHandshakeFromRpcResult = {
  sender: string
  nonce: bigint
  pubKeyRaw: Uint8Array
  source: HandshakeOfferSource
}

type DynEntry = { name?: { type?: string; value?: Record<string, string> } }

function typeMatchesHsKey(typeStr: string, packageId: string): boolean {
  const t = String(typeStr || '')
  return t === messagingStructType(packageId, 'HsKey') || t.endsWith('::messaging::HsKey')
}

function coerceParsedJsonByteVector(val: unknown): Uint8Array | null {
  if (val == null) return null
  if (val instanceof Uint8Array) return val.length ? new Uint8Array(val) : null
  if (Array.isArray(val)) {
    const a = val as unknown[]
    if (a.length === 0) return null
    for (const x of a) {
      if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x > 255) return null
    }
    return new Uint8Array(a as number[])
  }
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s) return null
    if (/^0x[0-9a-fA-F]+$/.test(s)) {
      const hex = s.slice(2)
      if (hex.length % 2 !== 0) return null
      const out = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        out[i / 2] = parseInt(hex.slice(i, i + 2), 16)
      }
      return out.length ? out : null
    }
  }
  return coerceMoveU8Vector(val).length ? coerceMoveU8Vector(val) : null
}

async function paginateDynamicFields(
  client: IotaClient,
  parentId: string,
  maxPages: number
): Promise<DynEntry[]> {
  const allEntries: DynEntry[] = []
  let cursor: string | null | undefined
  for (let page = 0; page < maxPages; page++) {
    const pageRes = (await client.getDynamicFields({
      parentId,
      limit: 500,
      ...(cursor ? { cursor } : {}),
    } as Parameters<IotaClient['getDynamicFields']>[0])) as {
      data?: DynEntry[]
      hasNextPage?: boolean
      nextCursor?: string | null
    }
    allEntries.push(...(pageRes.data ?? []))
    if (pageRes.hasNextPage !== true || !pageRes.nextCursor) break
    if (pageRes.nextCursor === cursor) break
    cursor = pageRes.nextCursor
  }
  return allEntries
}

async function collectIncomingSenderNorms(
  client: IotaClient,
  parentId: string,
  me: string,
  packageId: string,
  maxPages: number
): Promise<Set<string>> {
  const incoming = new Set<string>()
  const entries = await paginateDynamicFields(client, parentId, maxPages)
  for (const e of entries) {
    const typeStr = String(e.name?.type ?? '')
    if (!typeMatchesHsKey(typeStr, packageId)) continue
    const val = e.name?.value
    const rec = normalizeMailboxAddress(String(val?.recipient ?? ''))
    const sen = String(val?.sender ?? '').trim()
    if (rec !== me || !sen.startsWith('0x')) continue
    incoming.add(normalizeMailboxAddress(sen))
  }
  return incoming
}

async function collectOutgoingRecipientNorms(
  client: IotaClient,
  parentId: string,
  me: string,
  packageId: string,
  maxPages: number
): Promise<Set<string>> {
  const outgoing = new Set<string>()
  const entries = await paginateDynamicFields(client, parentId, maxPages)
  for (const e of entries) {
    const typeStr = String(e.name?.type ?? '')
    if (!typeMatchesHsKey(typeStr, packageId)) continue
    const val = e.name?.value
    const rec = String(val?.recipient ?? '').trim()
    const sen = normalizeMailboxAddress(String(val?.sender ?? ''))
    if (sen !== me || !rec.startsWith('0x')) continue
    outgoing.add(normalizeMailboxAddress(rec))
  }
  return outgoing
}

/** HsKey-Inhalt aus einer Mailbox (Dynamic Field). */
export async function fetchHsKeyFromMailbox(
  client: IotaClient,
  input: { packageId: string; mailboxObjectId: string; recipient: string; sender: string }
): Promise<{ sender: string; pubKeyRaw: Uint8Array; nonce: bigint } | null> {
  const parentId = input.mailboxObjectId.trim()
  const recipient = input.recipient.trim()
  const sender = input.sender.trim()
  if (!MAILBOX_INBOX_HEX64.test(parentId)) return null
  try {
    const resp = await client.getDynamicFieldObject({
      parentObjectId: parentId,
      name: { type: messagingStructType(input.packageId, 'HsKey'), value: { recipient, sender } },
      options: { showContent: true },
    } as Parameters<IotaClient['getDynamicFieldObject']>[0])
    const fields = (resp as { data?: { content?: { fields?: Record<string, unknown> } } })?.data?.content
      ?.fields
    if (!fields?.pub_key) return null
    const pubKeyRaw = coerceMoveU8Vector(fields.pub_key)
    if (!pubKeyRaw.length) return null
    return {
      sender,
      pubKeyRaw,
      nonce: BigInt(String(fields.nonce ?? '0')),
    }
  } catch {
    return null
  }
}

async function queryEcdhInitEvents(
  client: IotaClient,
  packageId: string,
  limit: number
): Promise<
  Array<{
    type?: string
    parsedJson?: {
      recipient?: string
      sender?: string
      pub_key?: unknown
      pubKey?: unknown
      nonce?: number | string
    }
  }>
> {
  const pkg = packageId.trim()
  if (!MAILBOX_INBOX_HEX64.test(pkg)) return []
  const eventType = `${pkg}::messaging::EcdhInit`
  try {
    const primary = (await client.queryEvents({
      query: { MoveEventType: eventType },
      limit,
      order: 'descending',
    } as Parameters<IotaClient['queryEvents']>[0])) as { data?: unknown[] }
    return (primary.data ?? []) as Array<{
      type?: string
      parsedJson?: {
        recipient?: string
        sender?: string
        pub_key?: unknown
        pubKey?: unknown
        nonce?: number | string
      }
    }>
  } catch {
    return []
  }
}

function uniqueMailboxIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = raw.trim()
    const k = id.toLowerCase()
    if (!MAILBOX_INBOX_HEX64.test(id) || seen.has(k)) continue
    seen.add(k)
    out.push(id)
  }
  return out
}

/** Eingehende Handshake-Angebote (HsKey + EcdhInit), pro Absender höchste Nonce. */
export async function listIncomingHandshakeOffersRpc(
  client: IotaClient,
  input: ListHandshakeOffersRpcInput
): Promise<IncomingHandshakeOfferRpc[]> {
  const limit = Math.min(50, Math.max(1, input.limit ?? 20))
  const me = normalizeMailboxAddress(input.myAddress)
  const pkg = input.packageId.trim()
  if (!MAILBOX_INBOX_HEX64.test(pkg) || !MAILBOX_INBOX_HEX64.test(me)) return []

  const maxPages = Math.min(8, Math.max(1, input.maxDynamicFieldPages ?? 8))
  const eventLimit = Math.min(200, Math.max(1, input.eventLimit ?? 200))
  const mailboxIds = uniqueMailboxIds(input.mailboxObjectIds)

  const best = new Map<string, { sender: string; nonce: bigint; source: HandshakeOfferSource }>()

  const upsert = (senderRaw: string, nonce: bigint, source: HandshakeOfferSource) => {
    const sen = String(senderRaw || '').trim()
    if (!sen.startsWith('0x')) return
    const sn = normalizeMailboxAddress(sen)
    if (sn === me || !MAILBOX_INBOX_HEX64.test(sn)) return
    const prev = best.get(sn)
    if (!prev || nonce > prev.nonce) {
      best.set(sn, { sender: sen, nonce, source })
    } else if (prev && nonce === prev.nonce && source === 'mailbox') {
      best.set(sn, { sender: sen, nonce, source: 'mailbox' })
    }
  }

  for (const parentId of mailboxIds) {
    try {
      const senders = await collectIncomingSenderNorms(client, parentId, me, pkg, maxPages)
      for (const sn of senders) {
        const hs = await fetchHsKeyFromMailbox(client, {
          packageId: pkg,
          mailboxObjectId: parentId,
          recipient: input.myAddress,
          sender: sn,
        })
        if (hs) upsert(hs.sender, hs.nonce ?? 0n, 'mailbox')
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const rows = await queryEcdhInitEvents(client, pkg, eventLimit)
    for (const e of rows) {
      if (!e.type?.endsWith('::messaging::EcdhInit') || !e.parsedJson) continue
      const rec = normalizeMailboxAddress(String(e.parsedJson.recipient ?? ''))
      const sen = normalizeMailboxAddress(String(e.parsedJson.sender ?? ''))
      if (rec !== me || !sen || sen === me) continue
      upsert(sen, BigInt(e.parsedJson.nonce ?? 0), 'event')
    }
  } catch {
    /* ignore */
  }

  return [...best.values()]
    .sort((a, b) => (a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0))
    .slice(0, limit)
    .map((o) => ({ sender: o.sender, nonce: String(o.nonce), source: o.source }))
}

/** Gesendete Handshake-Angebote (HsKey + EcdhInit mit sender = ich). */
export async function listOutgoingHandshakeOffersRpc(
  client: IotaClient,
  input: ListHandshakeOffersRpcInput
): Promise<OutgoingHandshakeOfferRpc[]> {
  const limit = Math.min(50, Math.max(1, input.limit ?? 20))
  const me = normalizeMailboxAddress(input.myAddress)
  const pkg = input.packageId.trim()
  if (!MAILBOX_INBOX_HEX64.test(pkg) || !MAILBOX_INBOX_HEX64.test(me)) return []

  const maxPages = Math.min(8, Math.max(1, input.maxDynamicFieldPages ?? 8))
  const eventLimit = Math.min(200, Math.max(1, input.eventLimit ?? 200))
  const mailboxIds = uniqueMailboxIds(input.mailboxObjectIds)

  const best = new Map<string, { recipient: string; nonce: bigint; source: HandshakeOfferSource }>()

  const upsert = (recipientRaw: string, nonce: bigint, source: HandshakeOfferSource) => {
    const recRaw = String(recipientRaw || '').trim()
    if (!recRaw.startsWith('0x')) return
    const rn = normalizeMailboxAddress(recRaw)
    if (rn === me || !MAILBOX_INBOX_HEX64.test(rn)) return
    const prev = best.get(rn)
    if (!prev || nonce > prev.nonce) {
      best.set(rn, { recipient: recRaw, nonce, source })
    } else if (prev && nonce === prev.nonce && source === 'mailbox') {
      best.set(rn, { recipient: recRaw, nonce, source: 'mailbox' })
    }
  }

  for (const parentId of mailboxIds) {
    try {
      const recipients = await collectOutgoingRecipientNorms(client, parentId, me, pkg, maxPages)
      for (const rn of recipients) {
        const hs = await fetchHsKeyFromMailbox(client, {
          packageId: pkg,
          mailboxObjectId: parentId,
          recipient: rn,
          sender: input.myAddress,
        })
        if (hs) upsert(rn, hs.nonce ?? 0n, 'mailbox')
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const rows = await queryEcdhInitEvents(client, pkg, eventLimit)
    for (const e of rows) {
      if (!e.type?.endsWith('::messaging::EcdhInit') || !e.parsedJson) continue
      const rec = normalizeMailboxAddress(String(e.parsedJson.recipient ?? ''))
      const sen = normalizeMailboxAddress(String(e.parsedJson.sender ?? ''))
      if (sen !== me || !rec || rec === me) continue
      upsert(rec, BigInt(e.parsedJson.nonce ?? 0), 'event')
    }
  } catch {
    /* ignore */
  }

  return [...best.values()]
    .sort((a, b) => (a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0))
    .slice(0, limit)
    .map((o) => ({ recipient: o.recipient, nonce: String(o.nonce), source: o.source }))
}

/** Handshake von bestimmtem Peer (Mailbox-Union, dann EcdhInit-Events). */
export async function findPeerHandshakeFromRpc(
  client: IotaClient,
  input: ListHandshakeOffersRpcInput & { peerAddress: string }
): Promise<FindPeerHandshakeFromRpcResult | null> {
  const me = normalizeMailboxAddress(input.myAddress)
  const peer = normalizeMailboxAddress(input.peerAddress)
  const pkg = input.packageId.trim()
  if (!MAILBOX_INBOX_HEX64.test(pkg) || !MAILBOX_INBOX_HEX64.test(me) || !MAILBOX_INBOX_HEX64.test(peer)) {
    return null
  }

  const mailboxIds = uniqueMailboxIds(input.mailboxObjectIds)
  for (const parentId of mailboxIds) {
    const hs = await fetchHsKeyFromMailbox(client, {
      packageId: pkg,
      mailboxObjectId: parentId,
      recipient: input.myAddress,
      sender: peer,
    })
    if (hs?.pubKeyRaw?.length) {
      return { sender: hs.sender, nonce: hs.nonce, pubKeyRaw: hs.pubKeyRaw, source: 'mailbox' }
    }
  }

  try {
    const rows = await queryEcdhInitEvents(client, pkg, Math.min(100, input.eventLimit ?? 100))
    const match = rows.find((e) => {
      if (!e.type?.endsWith('::messaging::EcdhInit') || !e.parsedJson) return false
      const rec = normalizeMailboxAddress(String(e.parsedJson.recipient ?? ''))
      const sen = normalizeMailboxAddress(String(e.parsedJson.sender ?? ''))
      return rec === me && sen === peer
    })
    if (match?.parsedJson) {
      const pubKeyRaw = coerceParsedJsonByteVector(match.parsedJson.pub_key ?? match.parsedJson.pubKey)
      if (!pubKeyRaw?.length) return null
      const senderRaw = String(match.parsedJson.sender ?? '').trim()
      if (!senderRaw.startsWith('0x')) return null
      return {
        pubKeyRaw,
        sender: senderRaw,
        nonce: BigInt(match.parsedJson.nonce ?? 0),
        source: 'event',
      }
    }
  } catch {
    /* ignore */
  }
  return null
}
