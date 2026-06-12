import type { IotaClient } from '@iota/iota-sdk/client'
import { coerceMoveU8Vector } from './mailbox-inbox-rpc-helpers'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

function messagingStructType(packageId: string, struct: string): string {
  return `${packageId.trim()}::messaging::${struct}`
}

function typeMatchesEinsatzManifestKey(typeStr: string, packageId: string): boolean {
  const t = String(typeStr || '')
  const expected = messagingStructType(packageId, 'EinsatzManifestKey')
  return t === expected || t.endsWith('::messaging::EinsatzManifestKey')
}

function normalizeMoveAddress(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return HEX64.test(s) ? s : ''
}

function u8VectorToHex(v: unknown): string | undefined {
  const bytes = coerceMoveU8Vector(v)
  if (!bytes.length) return undefined
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export type EinsatzManifestAnchorRow = {
  sequence: number
  einsatzIdMoveAddress: string
  manifestHashHex?: string
  merkleRootHex?: string
  sourceNetwork?: number
  messageCount?: number
  anchoredAtMs?: number
  anchorObjectId?: string
}

export type FetchEinsatzManifestAnchorsInput = {
  packageId: string
  registryObjectId: string
  einsatzIdMoveAddress: string
  maxDynamicFieldPages?: number
}

type DynEntry = { objectId?: string; name?: { type?: string; value?: Record<string, unknown> } }

/** § H.33 — Dynamic Fields `EinsatzManifestKey` unter der Registry (Mainnet). */
export async function fetchEinsatzManifestAnchorsForEinsatz(
  client: IotaClient,
  input: FetchEinsatzManifestAnchorsInput
): Promise<EinsatzManifestAnchorRow[]> {
  const pkg = input.packageId.trim()
  const reg = input.registryObjectId.trim()
  const einsatz = normalizeMoveAddress(input.einsatzIdMoveAddress)
  if (!HEX64.test(reg) || !einsatz) return []

  const maxPages = Math.min(50, Math.max(1, input.maxDynamicFieldPages ?? 20))
  const allEntries: DynEntry[] = []
  let cursor: string | null | undefined
  for (let page = 0; page < maxPages; page++) {
    const pageRes = (await client.getDynamicFields({
      parentId: reg,
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

  const matched = allEntries.filter((e) => {
    if (!typeMatchesEinsatzManifestKey(String(e?.name?.type ?? ''), pkg)) return false
    const val = e.name?.value
    return normalizeMoveAddress(val?.einsatz_id) === einsatz
  })

  if (matched.length === 0) return []

  const ids = matched.map((e) => e.objectId).filter((id): id is string => Boolean(id))
  const byObjectId = new Map<string, DynEntry>()
  for (const e of matched) {
    if (e.objectId) byObjectId.set(e.objectId, e)
  }

  type Obj = { data?: { content?: { fields?: Record<string, unknown> } } }
  const rows: EinsatzManifestAnchorRow[] = []
  const BATCH = 50

  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const part = (await client.multiGetObjects({
      ids: chunk,
      options: { showContent: true },
    } as Parameters<IotaClient['multiGetObjects']>[0])) as Obj[]

    for (let j = 0; j < chunk.length; j++) {
      const objectId = chunk[j]
      const fields = part[j]?.data?.content?.fields
      const nameVal = byObjectId.get(objectId)?.name?.value
      const seqFromName = Number(String(nameVal?.sequence ?? ''))
      const seqFromFields = Number(String(fields?.sequence ?? ''))
      const sequence = Number.isFinite(seqFromFields) && seqFromFields > 0 ? seqFromFields : seqFromName
      if (!Number.isFinite(sequence) || sequence < 0) continue
      rows.push({
        sequence,
        einsatzIdMoveAddress: einsatz,
        manifestHashHex: u8VectorToHex(fields?.manifest_hash),
        merkleRootHex: u8VectorToHex(fields?.merkle_root),
        sourceNetwork: Number(fields?.source_network),
        messageCount: Number(fields?.message_count),
        anchoredAtMs: Number(fields?.anchored_at_ms),
        anchorObjectId: objectId,
      })
    }
  }

  rows.sort((a, b) => a.sequence - b.sequence)
  return rows
}
