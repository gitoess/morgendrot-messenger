/**
 * § H.33e — Forensic Batch Archiv (Boss-API, Hintergrund-Scheduler).
 */
import type http from 'node:http'
import { CFG } from '../../config.js'
import type { ApiRouteContext, SendJsonFn } from './api-route-types.js'
import { denyForensicBatchMutate } from './forensic-batch-api-auth.js'
import { createIpRateLimiter, normalizeApiClientIp } from './api-ip-rate-limit.js'
import { runServerForensicBatchArchiveWithLock } from '../../shared/forensic-batch-runner.js'
import {
  exportForensicBatchRegistryJson,
  mergeForensicBatchRegistryImport,
  readForensicBatchRegistryFile,
  type ForensicBatchRegistryEntry,
} from '../../shared/forensic-batch-registry-file.js'
import {
  getForensicBatchSchedulerStatus,
  restartForensicBatchScheduler,
} from '../../shared/forensic-batch-scheduler.js'
import {
  forensicBatchModeFromEnv,
  parseForensicBatchModeInput,
} from '../../shared/forensic-batch-mode.js'
import {
  getEffectiveForensicBatchMode,
  hasForensicBatchAutoConfigFile,
  readForensicBatchAutoConfigFile,
  writeForensicBatchAutoConfigFile,
  type ForensicBatchAutoIntervalMin,
} from '../../shared/forensic-batch-auto-config.js'
import {
  filterValidForensicBatchRegistryEntries,
  FORENSIC_BATCH_REGISTRY_MAX_ENTRIES,
} from '@morgendrot/core/forensic-batch'

const FORENSIC_BATCH_MAX_BODY_BYTES = 2 * 1024 * 1024
const forensicMutateRateLimit = createIpRateLimiter(CFG.API_RATE_LIMIT_FORENSIC_BATCH_PER_MINUTE)

function denyForensicMutateRateLimit(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  cors: Record<string, string>,
  sendJson: SendJsonFn
): boolean {
  const ip = normalizeApiClientIp(req)
  if (!forensicMutateRateLimit.check(ip)) {
    sendJson(res, 429, { ok: false, error: 'Rate-Limit Forensic-Batch überschritten.' }, cors)
    return true
  }
  forensicMutateRateLimit.record(ip)
  return false
}

function canReadForensicBatchApi(): boolean {
  const role = CFG.ROLE
  return role === 'boss' || role === 'kommandant' || role === 'messenger'
}

/** Chain-Mutationen und Registry-Ersatz — nur Boss/Kommandant. */
function canMutateForensicBatchApi(): boolean {
  const role = CFG.ROLE
  return role === 'boss' || role === 'kommandant'
}

function denyIfUnauthorized(
  res: http.ServerResponse,
  cors: Record<string, string>,
  sendJson: SendJsonFn,
  mutate = false
): boolean {
  const ok = mutate ? canMutateForensicBatchApi() : canReadForensicBatchApi()
  if (ok) return false
  sendJson(
    res,
    403,
    {
      ok: false,
      error: mutate
        ? 'Nur Boss/Kommandant dürfen Batch-Archiv ausführen oder Registry ersetzen.'
        : 'Nur Boss/Kommandant/Werkstatt.',
    },
    cors
  )
  return true
}

async function readJsonBody(req: http.IncomingMessage, maxBytes = FORENSIC_BATCH_MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) {
      throw new Error(`Body zu groß (max. ${maxBytes} Byte).`)
    }
    chunks.push(buf)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw) as unknown
}

function parseIntervalBody(raw: unknown): ForensicBatchAutoIntervalMin | undefined {
  const n = Number(raw)
  if (n === 5 || n === 15 || n === 30) return n
  return undefined
}

export async function handleForensicBatchRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: string,
  cors: Record<string, string>,
  sendJson: SendJsonFn,
  ctx: ApiRouteContext
): Promise<boolean> {
  if (!url.startsWith('/api/forensic-batch')) return false
  if (denyIfUnauthorized(res, cors, sendJson)) return true

  if (url === '/api/forensic-batch/config' && req.method === 'GET') {
    const sched = getForensicBatchSchedulerStatus()
    sendJson(
      res,
      200,
      {
        ok: true,
        role: CFG.ROLE,
        myAddress: CFG.MY_ADDRESS ?? '',
        mode: getEffectiveForensicBatchMode(),
        envMode: forensicBatchModeFromEnv(),
        autoEnabled: sched.enabled,
        autoIntervalMin: sched.intervalMin,
        autoConfigFromFile: hasForensicBatchAutoConfigFile(),
        lastRunAt: sched.lastRunAt,
        lastStatus: sched.lastStatus,
        registryCount: readForensicBatchRegistryFile().length,
        envHint: 'Laufzeit: POST /api/forensic-batch/auto-config (PWA-Checkbox)',
      },
      cors
    )
    return true
  }

  if (url === '/api/forensic-batch/auto-config' && req.method === 'POST') {
    if (denyIfUnauthorized(res, cors, sendJson, true)) return true
    if (denyForensicMutateRateLimit(req, res, cors, sendJson)) return true
    if (denyForensicBatchMutate(req, res, cors, sendJson, ctx)) return true
    try {
      const body = (await readJsonBody(req)) as {
        autoEnabled?: unknown
        intervalMin?: unknown
        mode?: unknown
      }
      const patch: Parameters<typeof writeForensicBatchAutoConfigFile>[0] = {}
      if (typeof body.autoEnabled === 'boolean') patch.autoEnabled = body.autoEnabled
      const interval = parseIntervalBody(body.intervalMin)
      if (interval) patch.intervalMin = interval
      const mode = parseForensicBatchModeInput(body.mode)
      if (mode) patch.mode = mode
      if (
        patch.autoEnabled === undefined &&
        patch.intervalMin === undefined &&
        patch.mode === undefined
      ) {
        sendJson(res, 400, { ok: false, error: 'Keine gültigen Auto-Config-Felder.' }, cors)
        return true
      }
      const saved = writeForensicBatchAutoConfigFile(patch)
      restartForensicBatchScheduler()
      sendJson(
        res,
        200,
        {
          ok: true,
          config: saved,
          scheduler: getForensicBatchSchedulerStatus(),
        },
        cors
      )
    } catch {
      sendJson(res, 400, { ok: false, error: 'Ungültiger JSON-Body.' }, cors)
    }
    return true
  }

  if (url === '/api/forensic-batch/auto-config' && req.method === 'GET') {
    sendJson(
      res,
      200,
      {
        ok: true,
        config: readForensicBatchAutoConfigFile(),
        effective: {
          autoEnabled: getForensicBatchSchedulerStatus().enabled,
          intervalMin: getForensicBatchSchedulerStatus().intervalMin,
          mode: getEffectiveForensicBatchMode(),
        },
      },
      cors
    )
    return true
  }

  if (url === '/api/forensic-batch/run' && req.method === 'POST') {
    if (denyIfUnauthorized(res, cors, sendJson, true)) return true
    if (denyForensicMutateRateLimit(req, res, cors, sendJson)) return true
    if (denyForensicBatchMutate(req, res, cors, sendJson, ctx)) return true
    let mode = getEffectiveForensicBatchMode()
    try {
      const body = (await readJsonBody(req)) as { mode?: unknown }
      const parsed = parseForensicBatchModeInput(body.mode)
      if (parsed) mode = parsed
    } catch {
      /* leerer Body → effektiver Modus */
    }
    const out = await runServerForensicBatchArchiveWithLock({ onlyNew: true, mode })
    sendJson(res, out.ok ? 200 : 502, out, cors)
    return true
  }

  if (url === '/api/forensic-batch/registry' && req.method === 'GET') {
    sendJson(
      res,
      200,
      { ok: true, entries: readForensicBatchRegistryFile(), exportedAt: Date.now() },
      cors
    )
    return true
  }

  if (url === '/api/forensic-batch/registry' && req.method === 'POST') {
    if (denyIfUnauthorized(res, cors, sendJson, true)) return true
    if (denyForensicMutateRateLimit(req, res, cors, sendJson)) return true
    if (denyForensicBatchMutate(req, res, cors, sendJson, ctx)) return true
    try {
      const body = (await readJsonBody(req)) as {
        entries?: ForensicBatchRegistryEntry[]
        mode?: 'merge' | 'replace'
      }
      const mode = body.mode === 'replace' ? 'replace' : 'merge'
      const rawEntries = Array.isArray(body.entries) ? body.entries : []
      if (rawEntries.length > FORENSIC_BATCH_REGISTRY_MAX_ENTRIES) {
        sendJson(
          res,
          400,
          { ok: false, error: `Max. ${FORENSIC_BATCH_REGISTRY_MAX_ENTRIES} Registry-Einträge pro Import.` },
          cors
        )
        return true
      }
      const entries = filterValidForensicBatchRegistryEntries(rawEntries)
      if (rawEntries.length > 0 && entries.length === 0) {
        sendJson(res, 400, { ok: false, error: 'Keine gültigen Registry-Einträge im Import.' }, cors)
        return true
      }
      const result = await mergeForensicBatchRegistryImport(entries, mode)
      sendJson(res, 200, { ok: true, ...result }, cors)
    } catch {
      sendJson(res, 400, { ok: false, error: 'Ungültiger JSON-Body.' }, cors)
    }
    return true
  }

  if (url === '/api/forensic-batch/registry/export' && req.method === 'GET') {
    res.writeHead(200, {
      ...cors,
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="morgendrot-forensic-batch-registry.json"',
    })
    res.end(exportForensicBatchRegistryJson())
    return true
  }

  sendJson(res, 404, { ok: false, error: 'Unbekannter forensic-batch Endpunkt.' }, cors)
  return true
}
