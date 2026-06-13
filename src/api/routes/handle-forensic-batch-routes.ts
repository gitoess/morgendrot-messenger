/**
 * § H.33e — Forensic Batch Archiv (Boss-API, Hintergrund-Scheduler).
 */
import type http from 'node:http'
import { CFG } from '../../config.js'
import type { ApiRouteContext, SendJsonFn } from './api-route-types.js'
import { denyForensicBatchMutate } from './forensic-batch-api-auth.js'
import {
    denyForensicMutateRateLimit,
    denyForensicRole,
    isForensicBodyRecord,
    parseForensicIntervalMin,
    readForensicJsonBody,
} from './forensic-batch-route-helpers.js'
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
import { forensicBatchModeFromEnv, parseForensicBatchModeInput } from '../../shared/forensic-batch-mode.js'
import {
    getEffectiveForensicBatchMode,
    hasForensicBatchAutoConfigFile,
    readForensicBatchAutoConfigFile,
    writeForensicBatchAutoConfigFile,
} from '../../shared/forensic-batch-auto-config.js'
import {
    filterValidForensicBatchRegistryEntries,
    FORENSIC_BATCH_REGISTRY_MAX_ENTRIES,
} from '@morgendrot/core/forensic-batch'

async function handleForensicAutoConfigPost(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    ctx: ApiRouteContext
): Promise<void> {
    if (denyForensicRole(res, cors, sendJson, true)) return
    if (denyForensicMutateRateLimit(req, res, cors, sendJson)) return
    if (denyForensicBatchMutate(req, res, cors, sendJson, ctx)) return
    const bodyRead = await readForensicJsonBody(req)
    if (!bodyRead.ok) {
        sendJson(res, 400, { ok: false, error: bodyRead.error }, cors)
        return
    }
    if (!isForensicBodyRecord(bodyRead.data)) {
        sendJson(res, 400, { ok: false, error: 'Ungültiger JSON-Body.' }, cors)
        return
    }
    const body = bodyRead.data
    const patch: Parameters<typeof writeForensicBatchAutoConfigFile>[0] = {}
    if (typeof body.autoEnabled === 'boolean') patch.autoEnabled = body.autoEnabled
    const interval = parseForensicIntervalMin(body.intervalMin)
    if (interval) patch.intervalMin = interval
    const mode = parseForensicBatchModeInput(body.mode)
    if (mode) patch.mode = mode
    if (patch.autoEnabled === undefined && patch.intervalMin === undefined && patch.mode === undefined) {
        sendJson(res, 400, { ok: false, error: 'Keine gültigen Auto-Config-Felder.' }, cors)
        return
    }
    const saved = writeForensicBatchAutoConfigFile(patch)
    restartForensicBatchScheduler()
    sendJson(res, 200, { ok: true, config: saved, scheduler: getForensicBatchSchedulerStatus() }, cors)
}

async function handleForensicRunPost(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    ctx: ApiRouteContext
): Promise<void> {
    if (denyForensicRole(res, cors, sendJson, true)) return
    if (denyForensicMutateRateLimit(req, res, cors, sendJson)) return
    if (denyForensicBatchMutate(req, res, cors, sendJson, ctx)) return
    let mode = getEffectiveForensicBatchMode()
    const bodyRead = await readForensicJsonBody(req)
    if (bodyRead.ok && isForensicBodyRecord(bodyRead.data)) {
        const parsed = parseForensicBatchModeInput(bodyRead.data.mode)
        if (parsed) mode = parsed
    }
    const out = await runServerForensicBatchArchiveWithLock({ onlyNew: true, mode })
    sendJson(res, out.ok ? 200 : 502, out, cors)
}

async function handleForensicRegistryPost(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    ctx: ApiRouteContext
): Promise<void> {
    if (denyForensicRole(res, cors, sendJson, true)) return
    if (denyForensicMutateRateLimit(req, res, cors, sendJson)) return
    if (denyForensicBatchMutate(req, res, cors, sendJson, ctx)) return
    const bodyRead = await readForensicJsonBody(req)
    if (!bodyRead.ok) {
        sendJson(res, 400, { ok: false, error: bodyRead.error }, cors)
        return
    }
    if (!isForensicBodyRecord(bodyRead.data)) {
        sendJson(res, 400, { ok: false, error: 'Ungültiger JSON-Body.' }, cors)
        return
    }
    const mode = bodyRead.data.mode === 'replace' ? 'replace' : 'merge'
    const rawEntries = Array.isArray(bodyRead.data.entries) ? bodyRead.data.entries : []
    if (rawEntries.length > FORENSIC_BATCH_REGISTRY_MAX_ENTRIES) {
        sendJson(
            res,
            400,
            { ok: false, error: `Max. ${FORENSIC_BATCH_REGISTRY_MAX_ENTRIES} Registry-Einträge pro Import.` },
            cors
        )
        return
    }
    const entries = filterValidForensicBatchRegistryEntries(rawEntries)
    if (rawEntries.length > 0 && entries.length === 0) {
        sendJson(res, 400, { ok: false, error: 'Keine gültigen Registry-Einträge im Import.' }, cors)
        return
    }
    const result = await mergeForensicBatchRegistryImport(entries, mode)
    sendJson(res, 200, { ok: true, ...result }, cors)
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
    if (denyForensicRole(res, cors, sendJson, false)) return true

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
        await handleForensicAutoConfigPost(req, res, cors, sendJson, ctx)
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
        await handleForensicRunPost(req, res, cors, sendJson, ctx)
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
        await handleForensicRegistryPost(req, res, cors, sendJson, ctx)
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
