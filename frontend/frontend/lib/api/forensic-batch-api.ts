import { fetchApiText } from '@/frontend/lib/api-fetch-text'
import { API_BASE } from '@/frontend/lib/api/api-base'
import type { ForensicBatchRegistryEntry } from '@/frontend/lib/forensic-batch-registry'

export type ForensicBatchConfigResponse = {
  ok: true
  role?: string
  myAddress?: string
  mode: 'plaintext' | 'encrypted'
  envMode?: 'plaintext' | 'encrypted'
  autoEnabled: boolean
  autoIntervalMin: number
  autoConfigFromFile?: boolean
  lastRunAt: number
  lastStatus: string
  registryCount: number
  envHint?: string
}

export type ForensicBatchRunApiResult =
  | {
      ok: true
      preparedCount: number
      alreadyBatched: number
      skippedCount: number
      txCount: number
      digests: string[]
      messageCount: number
      mode: 'plaintext' | 'encrypted'
      viaApi: true
    }
  | { ok: false; error: string; partialDigests?: string[]; mode?: 'plaintext' | 'encrypted'; viaApi: true }

function parseJsonBody<T extends Record<string, unknown>>(text: string): T | null {
  try {
    const parsed = JSON.parse(text) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null
  } catch {
    return null
  }
}

/** Boss-API erreichbar und Rolle erlaubt Batch? */
export async function fetchForensicBatchConfig(): Promise<
  { ok: true; config: ForensicBatchConfigResponse } | { ok: false; error: string }
> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/forensic-batch/config')
    if (!fr.ok) return { ok: false, error: fr.error }
    const body = parseJsonBody<ForensicBatchConfigResponse & { ok?: boolean; error?: string }>(fr.text)
    if (!body?.ok) return { ok: false, error: body?.error || `HTTP ${fr.response.status}` }
    return { ok: true, config: body }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** POST `/api/forensic-batch/run` — Batch via Boss-Wallet (Klartext oder verschlüsselt). */
export async function runForensicBatchViaBossApi(
  mode?: 'plaintext' | 'encrypted'
): Promise<ForensicBatchRunApiResult> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/forensic-batch/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode ? { mode } : {}),
    })
    if (!fr.ok) return { ok: false, error: fr.error, viaApi: true }
    const body = parseJsonBody<{
      ok?: boolean
      error?: string
      preparedCount?: number
      alreadyBatched?: number
      skippedCount?: number
      txCount?: number
      digests?: string[]
      messageCount?: number
      partialDigests?: string[]
      mode?: 'plaintext' | 'encrypted'
    }>(fr.text)
    if (!body) return { ok: false, error: 'Antwort ist kein gültiges JSON.', viaApi: true }
    if (!body.ok) {
      return {
        ok: false,
        error: body.error || `HTTP ${fr.response.status}`,
        partialDigests: body.partialDigests,
        mode: body.mode,
        viaApi: true,
      }
    }
    return {
      ok: true,
      preparedCount: body.preparedCount ?? 0,
      alreadyBatched: body.alreadyBatched ?? 0,
      skippedCount: body.skippedCount ?? 0,
      txCount: body.txCount ?? 0,
      digests: Array.isArray(body.digests) ? body.digests : [],
      messageCount: body.messageCount ?? 0,
      mode: body.mode === 'encrypted' ? 'encrypted' : 'plaintext',
      viaApi: true,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), viaApi: true }
  }
}

export async function fetchForensicBatchRegistryFromBossApi(): Promise<
  { ok: true; entries: ForensicBatchRegistryEntry[] } | { ok: false; error: string }
> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/forensic-batch/registry')
    if (!fr.ok) return { ok: false, error: fr.error }
    const body = parseJsonBody<{ ok?: boolean; error?: string; entries?: ForensicBatchRegistryEntry[] }>(fr.text)
    if (!body?.ok) return { ok: false, error: body?.error || `HTTP ${fr.response.status}` }
    return { ok: true, entries: Array.isArray(body.entries) ? body.entries : [] }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function importForensicBatchRegistryToBossApi(
  entries: ForensicBatchRegistryEntry[],
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ ok: true; merged: number; total: number } | { ok: false; error: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/forensic-batch/registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, mode }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const body = parseJsonBody<{ ok?: boolean; error?: string; merged?: number; total?: number }>(fr.text)
    if (!body?.ok) return { ok: false, error: body?.error || `HTTP ${fr.response.status}` }
    return { ok: true, merged: body.merged ?? 0, total: body.total ?? 0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function postForensicBatchAutoConfig(body: {
  autoEnabled?: boolean
  intervalMin?: 5 | 15 | 30
  mode?: 'plaintext' | 'encrypted'
}): Promise<
  | { ok: true; autoEnabled: boolean; intervalMin: number; mode: 'plaintext' | 'encrypted' }
  | { ok: false; error: string }
> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/forensic-batch/auto-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const parsed = parseJsonBody<{
      ok?: boolean
      error?: string
      config?: { autoEnabled: boolean; intervalMin: number; mode?: string }
      scheduler?: { enabled: boolean; intervalMin: number }
    }>(fr.text)
    if (!parsed?.ok) {
      return { ok: false, error: parsed?.error || `HTTP ${fr.response.status}` }
    }
    const sched = parsed.scheduler
    const cfg = parsed.config
    return {
      ok: true,
      autoEnabled: sched?.enabled ?? cfg?.autoEnabled ?? false,
      intervalMin: sched?.intervalMin ?? cfg?.intervalMin ?? 15,
      mode: cfg?.mode === 'encrypted' ? 'encrypted' : 'plaintext',
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
