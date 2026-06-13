'use client'

import { FORENSIC_BATCH_CHANGED } from '@/frontend/lib/forensic-batch-config'
import {
  filterValidForensicBatchRegistryEntries,
  FORENSIC_BATCH_REGISTRY_MAX_ENTRIES,
  mergeForensicBatchRegistryEntries,
  recordForensicBatchRegistryEntries,
  type ForensicBatchRegistryEntry,
} from '@morgendrot/core/forensic-batch/registry'

export type { ForensicBatchRegistryEntry }

const LS_KEY = 'morgendrot.forensicBatchRegistry.v1'

export function readForensicBatchRegistry(): ForensicBatchRegistryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return filterValidForensicBatchRegistryEntries(arr)
  } catch {
    return []
  }
}

function saveForensicBatchRegistry(entries: ForensicBatchRegistryEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, FORENSIC_BATCH_REGISTRY_MAX_ENTRIES)))
    window.dispatchEvent(new CustomEvent(FORENSIC_BATCH_CHANGED))
  } catch {
    /* ignore */
  }
}

export function readForensicBatchCanonicalRefSet(): Set<string> {
  return new Set(readForensicBatchRegistry().map((e) => e.canonicalMsgRef.toLowerCase()))
}

export function lookupForensicBatchEntry(canonicalMsgRef: string): ForensicBatchRegistryEntry | undefined {
  const key = canonicalMsgRef.trim().toLowerCase()
  return readForensicBatchRegistry().find((e) => e.canonicalMsgRef.toLowerCase() === key)
}

export function recordForensicBatchEntries(
  entries: Array<{
    canonicalMsgRef: string
    messageId?: string
    batchDigest: string
    encrypted: boolean
    batchIndex?: number
  }>
): void {
  if (!entries.length) return
  const next = recordForensicBatchRegistryEntries(
    readForensicBatchRegistry(),
    entries,
    Date.now(),
    FORENSIC_BATCH_REGISTRY_MAX_ENTRIES
  )
  saveForensicBatchRegistry(next)
}

export function countForensicBatchRegistry(): number {
  return readForensicBatchRegistry().length
}

export function exportForensicBatchRegistryJson(): string {
  return JSON.stringify(readForensicBatchRegistry(), null, 2)
}

export function mergeForensicBatchRegistryImport(
  incoming: ForensicBatchRegistryEntry[],
  mode: 'merge' | 'replace' = 'merge'
): { merged: number; total: number } {
  const { merged, total, entries } = mergeForensicBatchRegistryEntries(
    readForensicBatchRegistry(),
    incoming,
    mode,
    { maxEntries: FORENSIC_BATCH_REGISTRY_MAX_ENTRIES }
  )
  saveForensicBatchRegistry(entries)
  return { merged, total }
}

export function importForensicBatchRegistryJson(
  json: string,
  mode: 'merge' | 'replace' = 'merge'
): { ok: true; merged: number; total: number } | { ok: false; error: string } {
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return { ok: false, error: 'JSON muss ein Array sein.' }
    const entries = filterValidForensicBatchRegistryEntries(arr)
    const result = mergeForensicBatchRegistryImport(entries, mode)
    return { ok: true, ...result }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ungültiges JSON.' }
  }
}

export function downloadForensicBatchRegistryExport(filename = 'morgendrot-forensic-batch-registry.json'): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([exportForensicBatchRegistryJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
