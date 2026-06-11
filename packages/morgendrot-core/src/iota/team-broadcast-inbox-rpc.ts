import type { IotaClient } from '@iota/iota-sdk/client'
import {
  coerceMoveU8Vector,
  MAILBOX_INBOX_HEX64,
} from './mailbox-inbox-rpc-helpers'

function typeMatchesTeamPlainBroadcastKey(typeStr: string, packageId: string): boolean {
  const t = String(typeStr || '')
  const expected = `${packageId.trim()}::messaging::TeamPlainBroadcastKey`
  return t === expected || t.endsWith('::messaging::TeamPlainBroadcastKey')
}

export type TeamPlainBroadcastRpcRow = {
  kind: 'team_plain'
  sender: string
  /** Team-Mailbox-Object-ID — synthetischer „Empfänger“ für UI/Filter. */
  teamMailboxObjectId: string
  text: string
  nonce: string
  ts?: number
  chainPurgeable: true
}

export type FetchTeamPlainBroadcastRpcInput = {
  teamMailboxObjectId: string
  packageId: string
  maxDynamicFieldPages?: number
  offset?: number
  limit?: number
}

type DynEntry = { objectId?: string; name?: { type?: string; value?: Record<string, unknown> } }

/**
 * Alle `TeamPlainBroadcastKey`-DFs am Team-Mailbox-Parent (kein Filter nach Empfänger).
 */
export async function fetchTeamPlainBroadcastRpcRows(
  client: IotaClient,
  input: FetchTeamPlainBroadcastRpcInput
): Promise<TeamPlainBroadcastRpcRow[]> {
  const mb = input.teamMailboxObjectId.trim()
  const pkg = input.packageId.trim()
  if (!MAILBOX_INBOX_HEX64.test(mb) || !MAILBOX_INBOX_HEX64.test(pkg)) {
    throw new Error('TEAM_MAILBOX_ID und PACKAGE_ID müssen gültige 0x-Objekt-IDs sein.')
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

  const ids = allEntries
    .filter((e) => typeMatchesTeamPlainBroadcastKey(String(e?.name?.type ?? ''), pkg))
    .map((e) => e.objectId)
    .filter((id): id is string => Boolean(id))

  if (ids.length === 0) return []

  const BATCH = 50
  type Obj = { data?: { content?: { fields?: Record<string, unknown> } } }
  const parsed: TeamPlainBroadcastRpcRow[] = []

  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const part = (await client.multiGetObjects({
      ids: chunk,
      options: { showContent: true },
    } as Parameters<IotaClient['multiGetObjects']>[0])) as Obj[]

    for (let j = 0; j < chunk.length; j++) {
      const f = part[j]?.data?.content?.fields
      if (!f) continue

      const sender = String(f.sender ?? '')
      const nonceRaw = f.nonce
      const nonce =
        typeof nonceRaw === 'bigint'
          ? nonceRaw
          : typeof nonceRaw === 'number' && Number.isFinite(nonceRaw)
            ? BigInt(Math.trunc(nonceRaw))
            : typeof nonceRaw === 'string' && nonceRaw.trim()
              ? BigInt(nonceRaw)
              : BigInt(0)
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
      const dec = new TextDecoder()
      parsed.push({
        kind: 'team_plain',
        sender,
        teamMailboxObjectId: mb,
        text: dec.decode(textBytes),
        nonce: String(nonce),
        ts: tsMs,
        chainPurgeable: true,
      })
    }
  }

  parsed.sort((a, b) => {
    const ta = a.ts ?? 0
    const tb = b.ts ?? 0
    if (tb !== ta) return tb - ta
    const na = BigInt(a.nonce)
    const nb = BigInt(b.nonce)
    return na > nb ? -1 : na < nb ? 1 : 0
  })

  return parsed.slice(offset, offset + limit)
}
