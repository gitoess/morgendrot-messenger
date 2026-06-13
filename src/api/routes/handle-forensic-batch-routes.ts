/**
 * § H.33e — Forensic Batch Archiv (Boss-API, Hintergrund-Scheduler).
 */
import type http from 'node:http'
import { CFG } from '../../config.js'
import type { SendJsonFn } from './api-route-types.js'
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
  startForensicBatchScheduler,
  stopForensicBatchScheduler,
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

function canAccessForensicBatchApi(): boolean {
  const role = CFG.ROLE
  return role === 'boss' || role === 'kommandant' || role === 'messenger'
}

function denyIfUnauthorized(
  res: http.ServerResponse,
  cors: Record<string, string>,
  sendJson: SendJsonFn
): boolean {
  if (canAccessForensicBatchApi()) return false
  sendJson(res, 403, { ok: false, error: 'Nur Boss/Kommandant/Werkstatt.' }, cors)
  return true
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
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
  sendJson: SendJsonFn
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
    } catch (e) {
      sendJson(
        res,
        400,
        { ok: false, error: e instanceof Error ? e.message : 'Ungültiger JSON-Body.' },
        cors
      )
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
    try {
      const body = (await readJsonBody(req)) as {
        entries?: ForensicBatchRegistryEntry[]
        mode?: 'merge' | 'replace'
      }
      const entries = Array.isArray(body.entries) ? body.entries : []
      const mode = body.mode === 'replace' ? 'replace' : 'merge'
      const result = await mergeForensicBatchRegistryImport(entries, mode)
      sendJson(res, 200, { ok: true, ...result }, cors)
    } catch (e) {
      sendJson(
        res,
        400,
        { ok: false, error: e instanceof Error ? e.message : 'Ungültiger JSON-Body.' },
        cors
      )
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

  if (url === '/api/forensic-batch/scheduler/start' && req.method === 'POST') {
    startForensicBatchScheduler()
    sendJson(res, 200, { ok: true, ...getForensicBatchSchedulerStatus() }, cors)
    return true
  }

  if (url === '/api/forensic-batch/scheduler/stop' && req.method === 'POST') {
    stopForensicBatchScheduler()
    sendJson(res, 200, { ok: true, stopped: true }, cors)
    return true
  }

  sendJson(res, 404, { ok: false, error: 'Unbekannter forensic-batch Endpunkt.' }, cors)
  return true
}
