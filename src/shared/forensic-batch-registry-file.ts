/**
 * § H.33e — Server-seitige Batch-Registry (Datei + Lock).
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  filterValidForensicBatchRegistryEntries,
  mergeForensicBatchRegistryEntries,
  recordForensicBatchRegistryEntries,
  type ForensicBatchRegistryEntry,
  FORENSIC_BATCH_REGISTRY_MAX_ENTRIES,
} from '@morgendrot/core/forensic-batch'
import {
  atomicWriteFileSync,
  enqueueForensicBatchRegistryOp,
} from './forensic-batch-registry-file-lock.js'

export type { ForensicBatchRegistryEntry }

const DEFAULT_FILE =
  process.env.FORENSIC_BATCH_REGISTRY_FILE?.trim() || '.morgendrot-forensic-batch-registry.json'

function registryPath(): string {
  return path.resolve(process.cwd(), DEFAULT_FILE)
}

function readForensicBatchRegistryFileUnlocked(): ForensicBatchRegistryEntry[] {
  const p = registryPath()
  try {
    if (!fs.existsSync(p)) return []
    const raw = fs.readFileSync(p, 'utf8')
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return filterValidForensicBatchRegistryEntries(arr)
  } catch {
    return []
  }
}

function writeForensicBatchRegistryFileUnlocked(entries: ForensicBatchRegistryEntry[]): void {
  const p = registryPath()
  atomicWriteFileSync(p, JSON.stringify(entries, null, 2))
}

export function readForensicBatchRegistryFile(): ForensicBatchRegistryEntry[] {
  return readForensicBatchRegistryFileUnlocked()
}

export function readForensicBatchCanonicalRefSetServer(): Set<string> {
  return new Set(readForensicBatchRegistryFile().map((e) => e.canonicalMsgRef.toLowerCase()))
}

export async function recordForensicBatchEntriesServer(
  entries: Array<{
    canonicalMsgRef: string
    messageId?: string
    batchDigest: string
    encrypted: boolean
    batchIndex?: number
  }>
): Promise<void> {
  if (!entries.length) return
  await enqueueForensicBatchRegistryOp(() => {
    const prev = readForensicBatchRegistryFileUnlocked()
    const next = recordForensicBatchRegistryEntries(prev, entries, Date.now(), FORENSIC_BATCH_REGISTRY_MAX_ENTRIES)
    writeForensicBatchRegistryFileUnlocked(next)
  })
}

export async function mergeForensicBatchRegistryImport(
  incoming: ForensicBatchRegistryEntry[],
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ merged: number; total: number }> {
  const valid = filterValidForensicBatchRegistryEntries(incoming)
  return enqueueForensicBatchRegistryOp(() => {
    const prev = readForensicBatchRegistryFileUnlocked()
    const { merged, total, entries } = mergeForensicBatchRegistryEntries(
      prev,
      valid,
      mode,
      { maxEntries: FORENSIC_BATCH_REGISTRY_MAX_ENTRIES }
    )
    writeForensicBatchRegistryFileUnlocked(entries)
    return { merged, total }
  })
}

export function exportForensicBatchRegistryJson(): string {
  return JSON.stringify(readForensicBatchRegistryFile(), null, 2)
}
