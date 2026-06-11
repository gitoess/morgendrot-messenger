import type { IotaClient } from '@iota/iota-sdk/client'
import {
  coerceMoveU8Vector,
  MAILBOX_INBOX_HEX64,
  messagingStructType,
  normalizeMailboxAddress,
} from './mailbox-inbox-rpc-helpers'

function typeMatchesPlainMsgKey(typeStr: string, packageId: string): boolean {
  const t = String(typeStr || '')
  return t === messagingStructType(packageId, 'PlainMsgKey') || t.endsWith('::messaging::PlainMsgKey')
}

function typeMatchesMsgKey(typeStr: string, packageId: string): boolean {
  const t = String(typeStr || '')
  return t === messagingStructType(packageId, 'MsgKey') || t.endsWith('::messaging::MsgKey')
}

export type MailboxInboxRpcPlainPiece = {
  kind: 'plain'
  sender: string
  recipient: string
  text: string
  nonce: string
  ts?: number
  chainPurgeable: true
}

export type MailboxInboxRpcEncryptedPiece = {
  kind: 'encrypted'
  sender: string
  recipient: string
  nonce: string
  ts?: number
  iv: Uint8Array
  ciphertext: Uint8Array
  tag: Uint8Array
  chainPurgeable: true
}

export type MailboxInboxRpcRow = MailboxInboxRpcPlainPiece | MailboxInboxRpcEncryptedPiece

export type FetchMailboxInboxRpcInput = {
  mailboxObjectId: string
  packageId: string
  myAddress: string
  includePlaintext: boolean
  includeEncrypted: boolean
  maxDynamicFieldPages?: number
  offset?: number
  limit?: number
}

type DynEntry = { objectId?: string; name?: { type?: string; value?: Record<string, unknown> } }

function parseChainTimeMs(raw: unknown): number | undefined {
  if (raw == null) return undefined
  const n =
    typeof raw === 'bigint'
      ? Number(raw)
      : typeof raw === 'string'
        ? parseInt(raw, 10)
        : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return undefined
  if (n < 1_000_000_000_000) return n * 1000
  return n
}

/** Wie `messenger-fetch.ts`: ms-Nonce, created_at_ms, expires − TTL. */
function resolveMailboxTsMs(
  rawCreated: unknown,
  rawExpires: unknown,
  nonce: bigint,
  ttlDays = 30
): number | undefined {
  const n = Number(nonce)
  if (Number.isFinite(n) && n >= 1_000_000_000_000) return n
  const created = parseChainTimeMs(rawCreated)
  const expires = parseChainTimeMs(rawExpires)
  if (expires != null && expires > 1_000_000_000_000) {
    const approx = expires - ttlDays * 86_400_000
    if (approx > 1_000_000_000_000) return approx
  }
  return created
}

function effectiveSortTs(tsMs: number | undefined, nonce: bigint): number {
  if (tsMs != null && Number.isFinite(tsMs) && tsMs > 0) return tsMs
  const n = Number(nonce)
  if (Number.isFinite(n) && n >= 1_000_000_000_000) return n
  return 0
}

/**
 * Einmal `getDynamicFields` am Mailbox-Parent: Klartext (`PlainMsgKey`) und/oder verschlüsselt (`MsgKey`),
 * gemeinsame Sortierung (wie `messenger-fetch.ts`), dann Offset/Limit.
 */
export async function fetchMailboxInboxRpcRows(
  client: IotaClient,
  input: FetchMailboxInboxRpcInput
): Promise<MailboxInboxRpcRow[]> {
  const mb = input.mailboxObjectId.trim()
  const pkg = input.packageId.trim()
  const myNorm = normalizeMailboxAddress(input.myAddress)
  if (!MAILBOX_INBOX_HEX64.test(mb) || !MAILBOX_INBOX_HEX64.test(pkg) || !MAILBOX_INBOX_HEX64.test(myNorm)) {
    throw new Error('MAILBOX_ID, PACKAGE_ID und MY_ADDRESS müssen gültige 0x-Objekt-/Adress-IDs sein.')
  }
  if (!input.includePlaintext && !input.includeEncrypted) {
    return []
  }

  const maxPages = Math.min(50, Math.max(1, input.maxDynamicFieldPages ?? 20))
  const offset = Math.max(0, Math.floor(input.offset ?? 0))
  const limit = Math.min(500, Math.max(1, input.limit ?? 50))

  const allEntries: DynEntry[] = []
  let cursor: string | null | undefined
  for (let page = 0; page < maxPages; page++) {
    const pageRes = (await client.getDynamicFields({
      parentId: mb,
      limit: 500,
      ...(cursor ? { cursor } : {}),
    } as Parameters<IotaClient['getDynamicFields']>[0])) as {
      data?: DynEntry[]
      hasNextPage?: boolean
      nextCursor?: string | null
    }
    const data = pageRes.data ?? []
    allEntries.push(...data)
    if (pageRes.hasNextPage !== true || !pageRes.nextCursor) break
    if (pageRes.nextCursor === cursor) break
    cursor = pageRes.nextCursor
  }

  const idToKind = new Map<string, 'plain' | 'encrypted'>()

  if (input.includePlaintext) {
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
    for (const e of [...plainKeyIn, ...plainKeyOut]) {
      const id = e.objectId
      if (id) idToKind.set(id, 'plain')
    }
  }

  if (input.includeEncrypted) {
    const msgKeyIn = allEntries.filter((e) => {
      const r = e?.name?.value?.recipient
      const t = String(e?.name?.type ?? '')
      return typeMatchesMsgKey(t, pkg) && r != null && normalizeMailboxAddress(String(r)) === myNorm
    })
    const msgKeyOut = allEntries.filter((e) => {
      const s = e?.name?.value?.sender
      const t = String(e?.name?.type ?? '')
      return typeMatchesMsgKey(t, pkg) && s != null && normalizeMailboxAddress(String(s)) === myNorm
    })
    for (const e of [...msgKeyIn, ...msgKeyOut]) {
      const id = e.objectId
      if (id) idToKind.set(id, 'encrypted')
    }
  }

  const ids = [...idToKind.keys()]
  if (ids.length === 0) return []

  const BATCH = 50
  type Obj = { data?: { content?: { fields?: Record<string, unknown> } } }
  const parsed: MailboxInboxRpcRow[] = []

  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const part = (await client.multiGetObjects({
      ids: chunk,
      options: { showContent: true },
    } as Parameters<IotaClient['multiGetObjects']>[0])) as Obj[]

    for (let j = 0; j < chunk.length; j++) {
      const objectId = chunk[j]!
      const kind = idToKind.get(objectId)
      const o = part[j]
      const f = o?.data?.content?.fields
      if (!f || !kind) continue

      const sender = String(f.sender ?? '')
      const recipient = String(f.recipient ?? '')
      const incoming = recipient != null && normalizeMailboxAddress(recipient) === myNorm
      const outgoing = sender != null && normalizeMailboxAddress(sender) === myNorm
      if (!incoming && !outgoing) continue

      const nonceRaw = f.nonce
      const nonce =
        typeof nonceRaw === 'bigint'
          ? nonceRaw
          : typeof nonceRaw === 'number' && Number.isFinite(nonceRaw)
            ? BigInt(Math.trunc(nonceRaw))
            : typeof nonceRaw === 'string' && nonceRaw.trim()
              ? BigInt(nonceRaw)
              : BigInt(0)
      const tsMs = resolveMailboxTsMs(f.created_at_ms, f.expires_at_ms, nonce)

      if (kind === 'plain') {
        const textBytes = coerceMoveU8Vector(f.text)
        if (textBytes.length === 0) continue
        const dec = new TextDecoder()
        parsed.push({
          kind: 'plain',
          sender,
          recipient,
          text: dec.decode(textBytes),
          nonce: String(nonce),
          ts: tsMs,
          chainPurgeable: true,
        })
      } else {
        const ivBytes = coerceMoveU8Vector(f.iv)
        const cipherBytes = coerceMoveU8Vector(f.ciphertext)
        const tagBytes = coerceMoveU8Vector(f.tag)
        if (ivBytes.length < 12 || cipherBytes.length === 0 || tagBytes.length !== 16) continue
        parsed.push({
          kind: 'encrypted',
          sender,
          recipient,
          nonce: String(nonce),
          ts: tsMs,
          iv: ivBytes,
          ciphertext: cipherBytes,
          tag: tagBytes,
          chainPurgeable: true,
        })
      }
    }
  }

  parsed.sort((a, b) => {
    const ta = effectiveSortTs(a.ts, BigInt(a.nonce))
    const tb = effectiveSortTs(b.ts, BigInt(b.nonce))
    if (tb !== ta) return tb - ta
    const na = BigInt(a.nonce)
    const nb = BigInt(b.nonce)
    return na > nb ? -1 : na < nb ? 1 : 0
  })

  return parsed.slice(offset, offset + limit)
}
