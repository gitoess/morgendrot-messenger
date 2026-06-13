export type ForensicBatchRegistryEntry = {
  canonicalMsgRef: string
  messageId?: string
  batchDigest: string
  batchedAtMs: number
  encrypted: boolean
  batchIndex?: number
}

export const FORENSIC_BATCH_REGISTRY_MAX_ENTRIES = 5_000

const CANONICAL_REF_HEX = /^[a-f0-9]{64}$/
const BATCH_DIGEST = /^0x[a-fA-F0-9]{64}$/

export function isValidForensicBatchRegistryEntry(x: unknown): x is ForensicBatchRegistryEntry {
  if (!x || typeof x !== 'object') return false
  const e = x as ForensicBatchRegistryEntry
  const ref = e.canonicalMsgRef?.trim().toLowerCase()
  const digest = e.batchDigest?.trim()
  return (
    typeof ref === 'string' &&
    CANONICAL_REF_HEX.test(ref) &&
    typeof digest === 'string' &&
    BATCH_DIGEST.test(digest) &&
    Number.isFinite(e.batchedAtMs) &&
    typeof e.encrypted === 'boolean'
  )
}

export function filterValidForensicBatchRegistryEntries(
  arr: readonly unknown[]
): ForensicBatchRegistryEntry[] {
  return arr.filter(isValidForensicBatchRegistryEntry)
}

export function sortAndCapForensicBatchRegistry(
  entries: readonly ForensicBatchRegistryEntry[],
  maxEntries = FORENSIC_BATCH_REGISTRY_MAX_ENTRIES
): ForensicBatchRegistryEntry[] {
  return [...entries].sort((a, b) => b.batchedAtMs - a.batchedAtMs).slice(0, maxEntries)
}

export function mergeForensicBatchRegistryEntries(
  prev: readonly ForensicBatchRegistryEntry[],
  incoming: readonly ForensicBatchRegistryEntry[],
  mode: 'merge' | 'replace' = 'merge',
  opts?: { maxEntries?: number }
): { merged: number; total: number; entries: ForensicBatchRegistryEntry[] } {
  const maxEntries = opts?.maxEntries ?? FORENSIC_BATCH_REGISTRY_MAX_ENTRIES
  const valid = incoming.filter((e) => e.canonicalMsgRef?.trim() && e.batchDigest?.trim())
  if (mode === 'replace') {
    const entries = sortAndCapForensicBatchRegistry(valid, maxEntries)
    return { merged: entries.length, total: entries.length, entries }
  }
  const byRef = new Map(prev.map((e) => [e.canonicalMsgRef.toLowerCase(), e]))
  let merged = 0
  for (const e of valid) {
    const ref = e.canonicalMsgRef.toLowerCase()
    const existing = byRef.get(ref)
    if (!existing || e.batchedAtMs >= existing.batchedAtMs) {
      byRef.set(ref, { ...e, canonicalMsgRef: ref })
      merged++
    }
  }
  const entries = sortAndCapForensicBatchRegistry([...byRef.values()], maxEntries)
  return { merged, total: entries.length, entries }
}

export function recordForensicBatchRegistryEntries(
  prev: readonly ForensicBatchRegistryEntry[],
  records: Array<{
    canonicalMsgRef: string
    messageId?: string
    batchDigest: string
    encrypted: boolean
    batchIndex?: number
  }>,
  now = Date.now(),
  maxEntries = FORENSIC_BATCH_REGISTRY_MAX_ENTRIES
): ForensicBatchRegistryEntry[] {
  if (!records.length) return [...prev]
  const byRef = new Map(prev.map((e) => [e.canonicalMsgRef.toLowerCase(), e]))
  for (const e of records) {
    const ref = e.canonicalMsgRef.trim().toLowerCase()
    if (!ref || !e.batchDigest.trim()) continue
    byRef.set(ref, {
      canonicalMsgRef: ref,
      messageId: e.messageId,
      batchDigest: e.batchDigest.trim(),
      batchedAtMs: now,
      encrypted: e.encrypted,
      batchIndex: e.batchIndex,
    })
  }
  return sortAndCapForensicBatchRegistry([...byRef.values()], maxEntries)
}
