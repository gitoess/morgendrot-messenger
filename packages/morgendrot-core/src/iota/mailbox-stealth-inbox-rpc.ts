import type { IotaClient } from '@iota/iota-sdk/client'
import { coerceMoveU8Vector, MAILBOX_INBOX_HEX64 } from './mailbox-inbox-rpc-helpers'

export type StealthInboxEntryRpc = {
  entryId: bigint
  ciphertext: Uint8Array
  iv: Uint8Array
  aesTag: Uint8Array
  deleteCommit: Uint8Array
  createdAtMs: number
  expiresAtMs: number
}

export type StealthInboxBucketRpc = {
  slotTag: Uint8Array
  entries: StealthInboxEntryRpc[]
  nextEntryId: bigint
  /** Chain-Object-ID des Buckets (optional). */
  objectId?: string
}

export type FetchStealthBucketsRpcInput = {
  mailboxObjectId: string
  /** Package, das `StealthSlotKey` / `StealthBucket` definiert (= Call-Package nach Upgrade). */
  callPackageId: string
  slotTags: Uint8Array[]
}

export type ScanStealthBucketsRpcInput = {
  mailboxObjectId: string
  callPackageId: string
  /** Optional: nur diese Tags (Hex lowercase ohne 0x). Leer = alle Stealth-Buckets. */
  onlySlotTagHex?: Set<string> | string[]
  maxDynamicFieldPages?: number
}

function stealthSlotKeyType(callPackageId: string): string {
  return `${callPackageId.trim()}::messaging::StealthSlotKey`
}

function typeMatchesStealthSlotKey(typeStr: string, callPackageId: string): boolean {
  const t = String(typeStr || '')
  const want = stealthSlotKeyType(callPackageId)
  return t === want || t.endsWith('::messaging::StealthSlotKey')
}

function tagToHex(tag: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < tag.length; i++) hex += tag[i]!.toString(16).padStart(2, '0')
  return hex
}

function coerceTagFromNameValue(raw: unknown): Uint8Array | null {
  if (raw == null) return null
  if (raw instanceof Uint8Array) return raw.length === 32 ? new Uint8Array(raw) : null
  if (Array.isArray(raw)) {
    const u8 = new Uint8Array(raw.map((x) => (typeof x === 'number' ? x & 0xff : Number(x) & 0xff)))
    return u8.length === 32 ? u8 : null
  }
  if (typeof raw === 'string' && /^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    const hex = raw.trim()
    const out = new Uint8Array(32)
    for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    return out
  }
  return null
}

function parseU64(raw: unknown): bigint {
  if (typeof raw === 'bigint') return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) return BigInt(Math.trunc(raw))
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return BigInt(raw.trim())
    } catch {
      return 0n
    }
  }
  return 0n
}

function parseEntry(raw: unknown): StealthInboxEntryRpc | null {
  if (!raw || typeof raw !== 'object') return null
  const f = (raw as { fields?: Record<string, unknown> }).fields ?? (raw as Record<string, unknown>)
  const ciphertext = coerceMoveU8Vector(f.ciphertext)
  const iv = coerceMoveU8Vector(f.iv)
  const aesTag = coerceMoveU8Vector(f.aes_tag ?? f.aesTag)
  const deleteCommit = coerceMoveU8Vector(f.delete_commit ?? f.deleteCommit)
  if (ciphertext.length < 1 || iv.length < 12 || aesTag.length !== 16) return null
  return {
    entryId: parseU64(f.entry_id ?? f.entryId),
    ciphertext,
    iv,
    aesTag,
    deleteCommit,
    createdAtMs: Number(parseU64(f.created_at_ms ?? f.createdAtMs)),
    expiresAtMs: Number(parseU64(f.expires_at_ms ?? f.expiresAtMs)),
  }
}

function parseBucketFields(
  fields: Record<string, unknown>,
  slotTag: Uint8Array,
  objectId?: string
): StealthInboxBucketRpc | null {
  const rawEntries = fields.entries
  const list: unknown[] = Array.isArray(rawEntries)
    ? rawEntries
    : rawEntries && typeof rawEntries === 'object' && Array.isArray((rawEntries as { vec?: unknown }).vec)
      ? ((rawEntries as { vec: unknown[] }).vec as unknown[])
      : []
  const entries: StealthInboxEntryRpc[] = []
  for (const e of list) {
    const parsed = parseEntry(e)
    if (parsed) entries.push(parsed)
  }
  return {
    slotTag: new Uint8Array(slotTag),
    entries,
    nextEntryId: parseU64(fields.next_entry_id ?? fields.nextEntryId),
    ...(objectId ? { objectId } : {}),
  }
}

function extractContentFields(resp: unknown): Record<string, unknown> | null {
  const d = resp as {
    data?: {
      content?: {
        fields?: Record<string, unknown>
        content?: { fields?: Record<string, unknown> }
      }
      error?: unknown
    }
    error?: unknown
  }
  if (d?.data?.error != null || d?.error != null) return null
  const top = d?.data?.content?.fields ?? d?.data?.content?.content?.fields
  if (!top) return null
  /** Field-Wrapper: Bucket unter `value.fields`. */
  const value = top.value
  if (value && typeof value === 'object') {
    const vf = (value as { fields?: Record<string, unknown> }).fields
    if (vf && (vf.entries != null || vf.next_entry_id != null || vf.nextEntryId != null)) return vf
  }
  return top
}

type DynEntry = {
  objectId?: string
  name?: { type?: string; value?: { tag?: unknown } }
}

/**
 * Robust: alle `StealthSlotKey`-DFs der Mailbox listen und Buckets laden.
 * Preferiert gegenüber reinem getDynamicFieldObject (Tag-Encoding/Clock).
 */
export async function scanStealthBucketsFromMailbox(
  client: IotaClient,
  input: ScanStealthBucketsRpcInput
): Promise<StealthInboxBucketRpc[]> {
  const mb = input.mailboxObjectId.trim()
  const callPkg = input.callPackageId.trim()
  if (!MAILBOX_INBOX_HEX64.test(mb) || !MAILBOX_INBOX_HEX64.test(callPkg)) {
    throw new Error('MAILBOX_ID und callPackageId müssen gültige 0x-IDs sein.')
  }

  const only =
    input.onlySlotTagHex == null
      ? null
      : input.onlySlotTagHex instanceof Set
        ? input.onlySlotTagHex
        : new Set(input.onlySlotTagHex.map((h) => h.toLowerCase().replace(/^0x/, '')))

  const maxPages = Math.min(40, Math.max(1, input.maxDynamicFieldPages ?? 8))
  const candidates: { objectId: string; tag: Uint8Array }[] = []
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
    for (const e of pageRes.data ?? []) {
      const t = String(e.name?.type ?? '')
      if (!typeMatchesStealthSlotKey(t, callPkg)) continue
      const tag = coerceTagFromNameValue(e.name?.value?.tag)
      if (!tag || !e.objectId) continue
      if (only && !only.has(tagToHex(tag))) continue
      candidates.push({ objectId: e.objectId, tag })
    }
    if (pageRes.hasNextPage !== true || !pageRes.nextCursor) break
    if (pageRes.nextCursor === cursor) break
    cursor = pageRes.nextCursor
  }

  if (candidates.length === 0) return []

  const out: StealthInboxBucketRpc[] = []
  const BATCH = 50
  for (let i = 0; i < candidates.length; i += BATCH) {
    const chunk = candidates.slice(i, i + BATCH)
    const part = (await client.multiGetObjects({
      ids: chunk.map((c) => c.objectId),
      options: { showContent: true },
    } as Parameters<IotaClient['multiGetObjects']>[0])) as Array<{
      data?: { content?: { fields?: Record<string, unknown> } }
    }>
    for (let j = 0; j < chunk.length; j++) {
      const fields = part[j]?.data?.content?.fields
      if (!fields) continue
      const bucket = parseBucketFields(fields, chunk[j]!.tag, chunk[j]!.objectId)
      if (bucket && bucket.entries.length > 0) out.push(bucket)
    }
  }
  return out
}

/**
 * Lookahead: pro `slot_tag` ein `getDynamicFieldObject` (`StealthSlotKey` → `StealthBucket`).
 * Fehlende Buckets werden übersprungen. Bei Misses lieber `scanStealthBucketsFromMailbox` nutzen.
 */
export async function fetchStealthBucketsForSlotTags(
  client: IotaClient,
  input: FetchStealthBucketsRpcInput
): Promise<StealthInboxBucketRpc[]> {
  const mb = input.mailboxObjectId.trim()
  const callPkg = input.callPackageId.trim()
  if (!MAILBOX_INBOX_HEX64.test(mb) || !MAILBOX_INBOX_HEX64.test(callPkg)) {
    throw new Error('MAILBOX_ID und callPackageId müssen gültige 0x-IDs sein.')
  }
  const keyType = stealthSlotKeyType(callPkg)
  const out: StealthInboxBucketRpc[] = []
  const seen = new Set<string>()

  for (const tag of input.slotTags) {
    if (!(tag instanceof Uint8Array) || tag.length !== 32) continue
    const hex = tagToHex(tag)
    if (seen.has(hex)) continue
    seen.add(hex)
    try {
      const resp = await client.getDynamicFieldObject({
        parentObjectId: mb,
        name: {
          type: keyType,
          value: { tag: Array.from(tag) },
        },
        options: { showContent: true },
      } as Parameters<IotaClient['getDynamicFieldObject']>[0])
      const fields = extractContentFields(resp)
      if (!fields) continue
      const bucket = parseBucketFields(fields, tag)
      if (bucket && bucket.entries.length > 0) out.push(bucket)
    } catch {
      /* missing / RPC — skip */
    }
  }

  /** Fallback: DOF-Scan, falls getDynamicFieldObject leer blieb. */
  if (out.length === 0 && input.slotTags.length > 0) {
    return scanStealthBucketsFromMailbox(client, {
      mailboxObjectId: mb,
      callPackageId: callPkg,
      onlySlotTagHex: [...seen],
    })
  }
  return out
}

/**
 * Wall-Clock für Sortierung: `StealthStored`-Event-`timestampMs`.
 * Move `created_at_ms` via `epoch_timestamp_ms` kann auf Testnet/Checkpoint kleben
 * (mehrere Entries gleiche ms) — dann wirkt ältere Visitenkarte „neuer“.
 */
export async function fetchStealthStoredEventTimestamps(
  client: IotaClient,
  input: { callPackageId: string; limit?: number }
): Promise<Map<string, number>> {
  const callPkg = input.callPackageId.trim()
  const out = new Map<string, number>()
  if (!MAILBOX_INBOX_HEX64.test(callPkg)) return out
  const eventType = `${callPkg}::messaging::StealthStored`
  const limit = Math.min(200, Math.max(10, input.limit ?? 80))
  try {
    const res = (await client.queryEvents({
      query: { MoveEventType: eventType },
      limit,
      order: 'descending',
    } as Parameters<IotaClient['queryEvents']>[0])) as {
      data?: Array<{
        timestampMs?: string | number | null
        parsedJson?: { entry_id?: string | number; slot_tag?: unknown }
      }>
    }
    for (const ev of res.data ?? []) {
      const rawTs = ev.timestampMs
      const ts =
        typeof rawTs === 'number'
          ? rawTs
          : typeof rawTs === 'string' && rawTs.trim()
            ? Number(rawTs)
            : NaN
      if (!Number.isFinite(ts) || ts <= 0) continue
      const tag = coerceTagFromNameValue(ev.parsedJson?.slot_tag)
      if (!tag) continue
      const entryId = String(ev.parsedJson?.entry_id ?? '').trim()
      if (!entryId) continue
      const key = `${tagToHex(tag)}:${entryId}`
      const prev = out.get(key)
      if (prev == null || ts > prev) out.set(key, ts)
    }
  } catch {
    /* Events optional */
  }
  return out
}

/** Map-Key wie in `fetchStealthStoredEventTimestamps`. */
export function stealthStoredEventMapKey(slotTag: Uint8Array, entryId: bigint | number | string): string {
  return `${tagToHex(slotTag)}:${String(entryId)}`
}
