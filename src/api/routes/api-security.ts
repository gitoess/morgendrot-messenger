/**
 * API-Sicherheit: Loopback, Token, CORS, Secret-Commands (Einsatz-LAN-Hardening).
 */
import type http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { CFG } from '../../config.js'
import type { SendJsonFn } from './api-route-types.js'
import { normalizeApiClientIp } from './api-ip-rate-limit.js'

/** Browser-Origin z. B. vom Handy im WLAN (192.168.x.x). */
export function isPrivateLanOrigin(origin: string): boolean {
    try {
        const u = new URL(origin)
        const h = u.hostname
        if (h === 'localhost' || h === '127.0.0.1') return true
        const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
        if (!m) return false
        const a = Number(m[1])
        const b = Number(m[2])
        const c = Number(m[3])
        const d = Number(m[4])
        if ([a, b, c, d].some((n) => n > 255)) return false
        if (a === 10) return true
        if (a === 172 && b >= 16 && b <= 31) return true
        if (a === 192 && b === 168) return true
        return false
    } catch {
        return false
    }
}

export function isLoopbackClient(req: http.IncomingMessage): boolean {
    const ip = normalizeApiClientIp(req)
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost'
}

export function isApiExternallyReachable(): boolean {
    const h = (CFG.API_BIND_HOST || '').trim().toLowerCase()
    return h === '0.0.0.0' || h === '::' || (h !== '127.0.0.1' && h !== 'localhost' && h !== '::1' && h !== '')
}

export function apiAuthTokenFromRequest(req: http.IncomingMessage): string {
    const header = req.headers['x-morgendrot-api-token']
    if (typeof header === 'string' && header.trim()) return header.trim()
    const auth = req.headers.authorization
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
        return auth.slice(7).trim()
    }
    return ''
}

export function isApiAuthTokenValid(req: http.IncomingMessage): boolean {
    const expected = CFG.API_AUTH_TOKEN
    if (!expected) return false
    return isTimingSafeTokenMatch(apiAuthTokenFromRequest(req), expected)
}

export function isTimingSafeTokenMatch(got: string, expected: string): boolean {
    if (!got || !expected || got.length !== expected.length) return false
    try {
        return timingSafeEqual(Buffer.from(got), Buffer.from(expected))
    } catch {
        return false
    }
}

/** Loopback oder gültiges API-Token (LAN-Operator). */
export function isTrustedApiClient(req: http.IncomingMessage): boolean {
    return isLoopbackClient(req) || isApiAuthTokenValid(req)
}

export function denyUnlessTrustedApiClient(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): boolean {
    if (isTrustedApiClient(req)) return false
    sendJson(res, 403, { ok: false, error: 'Nur localhost oder gültiges API-Token (API_AUTH_TOKEN).' }, cors)
    return true
}

export function denyUnlessLoopbackClient(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): boolean {
    if (isLoopbackClient(req)) return false
    sendJson(res, 403, { ok: false, error: 'Dieser Endpunkt ist nur von localhost erreichbar.' }, cors)
    return true
}

export const VAULT_SECRET_COMMANDS = new Set([
    '/vault-show-signer-import',
    '/vault-show-ecdh-jwk',
    '/vault-ecdh-jwk',
])

export const VAULT_DEBUG_COMMANDS = new Set(['/vault-debug-chain', '/vault-list-chain'])

/** Webhooks von Drittanbietern — kein API_AUTH_TOKEN (eigene Secrets). */
export const API_LAN_MUTATION_EXEMPT_PATHS = new Set([
    '/api/integrations/telegram/webhook',
    '/api/shop/webhook/stripe',
])

export function isApiMutationMethod(method: string | undefined): boolean {
    const m = (method || '').toUpperCase()
    return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE'
}

export function isApiLanMutationExemptPath(url: string): boolean {
    const path = (url.split('?')[0] || '').trim()
    return API_LAN_MUTATION_EXEMPT_PATHS.has(path)
}

export function isVaultSecretCommand(cmd: string): boolean {
    return VAULT_SECRET_COMMANDS.has(String(cmd || '').trim().toLowerCase())
}

export function isVaultDebugCommand(cmd: string): boolean {
    return VAULT_DEBUG_COMMANDS.has(String(cmd || '').trim().toLowerCase())
}

export function isVaultProtectedCommand(cmd: string): boolean {
    const c = String(cmd || '').trim().toLowerCase()
    return isVaultSecretCommand(c) || isVaultDebugCommand(c)
}

/**
 * LAN-exponierte API: Mutationen nur von Loopback oder mit gültigem API_AUTH_TOKEN.
 * @returns true wenn der Request abgelehnt wurde
 */
export function denyUnlessTrustedForLanMutation(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): boolean {
    if (!isApiMutationMethod(req.method)) return false
    if (!isApiExternallyReachable()) return false
    if (isApiLanMutationExemptPath(url)) return false
    return denyUnlessTrustedApiClient(req, res, cors, sendJson)
}

export function warnIfLanApiMissingAuthToken(log: (msg: string) => void): void {
    if (!isApiExternallyReachable()) return
    if ((CFG.API_AUTH_TOKEN || '').trim()) return
    log(
        'API bindet auf LAN (API_BIND_HOST) ohne API_AUTH_TOKEN — POST/PUT/PATCH/DELETE sind für jedes Gerät im WLAN offen. Setze API_AUTH_TOKEN in .env und exportiere es im Handoff.'
    )
}

export function denyVaultSecretCommandUnlessTrusted(
    cmd: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>,
    sendJson: SendJsonFn
): boolean {
    if (!isVaultProtectedCommand(cmd)) return false
    if (isTrustedApiClient(req)) return false
    sendJson(
        res,
        403,
        {
            ok: false,
            error: 'Secret-Befehle nur von localhost oder mit API_AUTH_TOKEN — nicht über fremde LAN-Hosts.',
        },
        cors
    )
    return true
}

/** Blockiert Cross-Origin von anderer LAN-IP (evil.html auf 192.168.1.99 → Boss 192.168.1.50). */
export function isAllowedApiCorsOrigin(origin: string | undefined, req: http.IncomingMessage): boolean {
    if (!origin || origin === 'null' || origin === '') return true
    if (origin.startsWith('capacitor://')) return true
    try {
        const o = new URL(origin)
        const originHost = o.hostname.toLowerCase()
        if (originHost === 'localhost' || originHost === '127.0.0.1') return true
        const hostHeader = req.headers.host?.split(':')[0]?.toLowerCase()
        if (hostHeader && originHost === hostHeader) return true
        if (!CFG.API_STRICT_CORS) {
            return isPrivateLanOrigin(origin)
        }
        return false
    } catch {
        return false
    }
}
