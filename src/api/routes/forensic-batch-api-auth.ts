/**
 * Forensic-Batch-API: Token, Loopback, Tresor-Entsperrung für Mutationen.
 */
import type http from 'node:http'
import { CFG } from '../../config.js'
import type { ApiRouteContext } from './api-route-types.js'
import type { SendJsonFn } from './api-route-types.js'
import {
    apiAuthTokenFromRequest,
    isApiExternallyReachable,
    isLoopbackClient,
    isTimingSafeTokenMatch,
} from './api-security.js'

export function forensicApiTokenFromRequest(req: http.IncomingMessage): string {
    const header = req.headers['x-morgendrot-forensic-token']
    if (typeof header === 'string' && header.trim()) return header.trim()
    return apiAuthTokenFromRequest(req)
}

export function isLoopbackApiClient(req: http.IncomingMessage): boolean {
    return isLoopbackClient(req)
}

export function isForensicApiTokenValid(req: http.IncomingMessage): boolean {
    const expected = CFG.FORENSIC_BATCH_API_TOKEN
    if (!expected) return true
    return isTimingSafeTokenMatch(forensicApiTokenFromRequest(req), expected)
}

export function isVaultUnlockedForForensicApi(ctx: ApiRouteContext): boolean {
    return ctx.getResolvePassword() == null
}

/** @returns true wenn Mutation abgelehnt */
export function denyForensicBatchMutate(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    ctx: ApiRouteContext
): boolean {
    if (!isVaultUnlockedForForensicApi(ctx)) {
        sendJson(
            res,
            403,
            { ok: false, error: 'Tresor gesperrt — zuerst im UI entsperren, dann Batch ausführen.' },
            cors
        )
        return true
    }
    if (CFG.FORENSIC_BATCH_API_LOOPBACK_ONLY && !isLoopbackClient(req)) {
        sendJson(
            res,
            403,
            { ok: false, error: 'Forensic-Batch-Mutationen nur von localhost (FORENSIC_BATCH_API_LOOPBACK_ONLY).' },
            cors
        )
        return true
    }
    if (isApiExternallyReachable() && !CFG.FORENSIC_BATCH_API_TOKEN) {
        sendJson(
            res,
            403,
            {
                ok: false,
                error:
                    'Forensic-Batch-Mutationen auf LAN-API ohne FORENSIC_BATCH_API_TOKEN verboten — Token setzen oder API_BIND_HOST=127.0.0.1.',
            },
            cors
        )
        return true
    }
    if (!isForensicApiTokenValid(req)) {
        sendJson(res, 403, { ok: false, error: 'Forensic-API nicht autorisiert.' }, cors)
        return true
    }
    return false
}
