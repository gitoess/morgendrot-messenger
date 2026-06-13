/**
 * Forensic-Batch-HTTP: Body lesen, Rollen, Rate-Limit.
 */
import type http from 'node:http'
import { CFG } from '../../config.js'
import type { SendJsonFn } from './api-route-types.js'
import { readHttpBodyWithLimit } from './api-body-limit.js'
import { createIpRateLimiter, normalizeApiClientIp } from './api-ip-rate-limit.js'
import type { ForensicBatchAutoIntervalMin } from '../../shared/forensic-batch-auto-config.js'

export const FORENSIC_BATCH_MAX_BODY_BYTES = 2 * 1024 * 1024

const forensicMutateRateLimit = createIpRateLimiter(CFG.API_RATE_LIMIT_FORENSIC_BATCH_PER_MINUTE)

export function canReadForensicBatchApi(): boolean {
    const role = CFG.ROLE
    return role === 'boss' || role === 'kommandant' || role === 'messenger'
}

export function canMutateForensicBatchApi(): boolean {
    const role = CFG.ROLE
    return role === 'boss' || role === 'kommandant'
}

/** @returns true wenn Anfrage abgelehnt wurde */
export function denyForensicRole(
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    mutate: boolean
): boolean {
    const allowed = mutate ? canMutateForensicBatchApi() : canReadForensicBatchApi()
    if (allowed) return false
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

/** @returns true wenn Rate-Limit greift */
export function denyForensicMutateRateLimit(
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

export async function readForensicJsonBody(
    req: http.IncomingMessage
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    const bodyRead = await readHttpBodyWithLimit(req, FORENSIC_BATCH_MAX_BODY_BYTES)
    if (!bodyRead.ok) return bodyRead
    const raw = bodyRead.text.trim()
    if (!raw) return { ok: true, data: {} }
    try {
        return { ok: true, data: JSON.parse(raw) as unknown }
    } catch {
        return { ok: false, error: 'Ungültiger JSON-Body.' }
    }
}

export function parseForensicIntervalMin(raw: unknown): ForensicBatchAutoIntervalMin | undefined {
    const n = Number(raw)
    if (n === 5 || n === 15 || n === 30) return n
    return undefined
}

export function isForensicBodyRecord(data: unknown): data is Record<string, unknown> {
    return data !== null && typeof data === 'object' && !Array.isArray(data)
}
