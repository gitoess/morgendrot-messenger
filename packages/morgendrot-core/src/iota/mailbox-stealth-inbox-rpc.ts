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
}

export type FetchStealthBucketsRpcInput = {
  mailboxObjectId: string
  /** Package, das `StealthSlotKey` / `StealthBucket` definiert (= Call-Package nach Upgrade). */
  callPackageId: string
  slotTags: Uint8Array[]
}

function stealthSlotKeyType(callPackageId: string): string {
  return `${callPackageId.trim()}::messaging::StealthSlotKey`
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

function parseBucketFields(fields: Record<string, unknown>, slotTag: Uint8Array): StealthInboxBucketRpc | null {
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
  }
}

function extractContentFields(resp: unknown): Record<string, unknown> | null {
  const d = resp as {
    data?: {
      content?: { fields?: Record<string, unknown>; content?: { fields?: Record<string, unknown> } }
      error?: unknown
    }
    error?: unknown
  }
  if (d?.data?.error != null || d?.error != null) return null
  return d?.data?.content?.fields ?? d?.data?.content?.content?.fields ?? null
}

/**
 * Lookahead: pro `slot_tag` ein `getDynamicFieldObject` (`StealthSlotKey` → `StealthBucket`).
 * Fehlende Buckets werden übersprungen (kein Fehler).
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
    let hex = ''
    for (let i = 0; i < tag.length; i++) hex += tag[i]!.toString(16).padStart(2, '0')
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
  return out
}
