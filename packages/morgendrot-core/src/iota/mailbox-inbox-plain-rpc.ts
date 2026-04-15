import type { IotaClient } from '@iota/iota-sdk/client'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export function normalizeMailboxAddress(a: string): string {
  const t = String(a || '').trim().toLowerCase()
  return t.startsWith('0x') ? t : `0x${t}`
}

export function messagingStructType(packageId: string, local: 'MsgKey' | 'PlainMsgKey'): string {
  const pkg = packageId.trim()
  if (!HEX64.test(pkg)) throw new Error('PACKAGE_ID ungültig.')
  return `${pkg}::messaging::${local}`
}

function typeMatchesPlainMsgKey(typeStr: string, packageId: string): boolean {
  const t = String(typeStr || '')
  return t === messagingStructType(packageId, 'PlainMsgKey') || t.endsWith('::messaging::PlainMsgKey')
}

/** Move `vector<u8>` aus RPC-`fields` (Zahlenarray oder Uint8Array). */
export function coerceMoveU8Vector(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v
  if (Array.isArray(v)) {
    return new Uint8Array(v.map((x) => (typeof x === 'number' ? x & 0xff : Number(x) & 0xff)))
  }
  if (v && typeof v === 'object' && Array.isArray((v as { vec?: unknown }).vec)) {
    return coerceMoveU8Vector((v as { vec: unknown }).vec)
  }
  return new Uint8Array()
}

export type PlainMailboxRowForInbox = {
  sender: string
  recipient: string
  text: string
  nonce: string
  ts?: number
  chainPurgeable: true
}

export type FetchPlaintextMailboxInboxInput = {
  mailboxObjectId: string
  packageId: string
  myAddress: string
  /** Wie Node `fetchLastMessages`: Seiten à 500 Dynamic Fields, max. N Seiten. */
  maxDynamicFieldPages?: number
  /** Nach Sortierung (neueste zuerst): Offset für Pagination. */
  offset?: number
  /** Max. zurückgegebene Zeilen nach Offset. */
  limit?: number
}

/**
 * Liest **nur** purgebare **Klartext**-Mailbox-Einträge (`PlainMsgKey` / `PlaintextMailboxEntry`) per Fullnode —
 * gleiche Datenbasis wie `messenger-fetch.ts` (Mailbox-Zweig), ohne `/api/inbox`.
 */
export async function fetchPlaintextMailboxInboxRows(
  client: IotaClient,
  input: FetchPlaintextMailboxInboxInput
): Promise<PlainMailboxRowForInbox[]> {
  const mb = input.mailboxObjectId.trim()
  const pkg = input.packageId.trim()
  const myNorm = normalizeMailboxAddress(input.myAddress)
  if (!HEX64.test(mb) || !HEX64.test(pkg) || !HEX64.test(myNorm)) {
    throw new Error('MAILBOX_ID, PACKAGE_ID und MY_ADDRESS müssen gültige 0x-Objekt-/Adress-IDs sein.')
  }
  const maxPages = Math.min(50, Math.max(1, input.maxDynamicFieldPages ?? 20))
  const offset = Math.max(0, Math.floor(input.offset ?? 0))
  const limit = Math.min(500, Math.max(1, input.limit ?? 50))

  const allEntries: Array<{ objectId?: string; name?: { type?: string; value?: Record<string, unknown> } }> = []
  let cursor: string | null | undefined
  for (let page = 0; page < maxPages; page++) {
    const pageRes = (await client.getDynamicFields({
      parentId: mb,
      limit: 500,
      ...(cursor ? { cursor } : {}),
    } as Parameters<IotaClient['getDynamicFields']>[0])) as {
      data?: typeof allEntries
      hasNextPage?: boolean
      nextCursor?: string | null
    }
    const data = pageRes.data ?? []
    allEntries.push(...data)
    if (pageRes.hasNextPage !== true || !pageRes.nextCursor) break
    if (pageRes.nextCursor === cursor) break
    cursor = pageRes.nextCursor
  }

  const plainKeyIn = allEntries.filter((e) => {
    const r = e?.name?.value?.recipient
    const t = String(e?.name?.type ?? '')
    return typeMatchesPlainMsgKey(t, pkg) && r != null && normalizeMailboxAddress(String(r)) === myNorm
  })
  const plainKeyOut = allEntries.filter((e) => {
    const s = e?.name?.value?.sender
    const t = String(e?.name?.type ?? '')
    return typeMatchesPlainMsgKey(t, pkg) && s != null && normalizeMailboxAddress(String(s)) === myNorm
  })
  const ids = [...new Set([...plainKeyIn, ...plainKeyOut].map((e) => e.objectId).filter(Boolean))] as string[]
  if (ids.length === 0) return []

  const BATCH = 50
  const plainObjs: Array<{ data?: { content?: { fields?: Record<string, unknown> } } }> = []
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const part = (await client.multiGetObjects({
      ids: chunk,
      options: { showContent: true },
    } as Parameters<IotaClient['multiGetObjects']>[0])) as Array<{ data?: { content?: { fields?: Record<string, unknown> } } }>
    plainObjs.push(...(part ?? []))
  }

  type Item = { nonce: bigint; sender: string; recipient: string; text: Uint8Array; tsMs?: number; key: string }
  const items: Item[] = []
  for (const o of plainObjs) {
    const f = o?.data?.content?.fields
    if (!f) continue
    const sender = String(f.sender ?? '')
    const recipient = String(f.recipient ?? '')
    const incoming = recipient != null && normalizeMailboxAddress(recipient) === myNorm
    const outgoing = sender != null && normalizeMailboxAddress(sender) === myNorm
    if (!incoming && !outgoing) continue
    const nonce = BigInt(f.nonce ?? 0)
    const rawCreated = f.created_at_ms
    const createdNum =
      typeof rawCreated === 'bigint'
        ? Number(rawCreated)
        : typeof rawCreated === 'string'
          ? parseInt(rawCreated, 10)
          : Number(rawCreated ?? 0)
    const tsMs = Number.isFinite(createdNum) && createdNum > 0 ? createdNum : undefined
    const textBytes = coerceMoveU8Vector(f.text)
    if (textBytes.length === 0) continue
    items.push({
      nonce,
      sender,
      recipient,
      text: textBytes,
      tsMs,
      key: `plain:${sender}:${recipient}:${nonce}`,
    })
  }

  items.sort((a, b) => {
    const ta = a.tsMs ?? 0
    const tb = b.tsMs ?? 0
    if (tb !== ta) return tb - ta
    return a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0
  })
  const slice = items.slice(offset, offset + limit)
  const dec = new TextDecoder()
  return slice.map((m) => ({
    sender: m.sender,
    recipient: m.recipient,
    text: dec.decode(m.text),
    nonce: String(m.nonce),
    ts: m.tsMs,
    chainPurgeable: true as const,
  }))
}
