/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'
import type http from 'node:http'
import type { ServerResponse } from 'node:http'

vi.mock('../../config.js', () => ({
    CFG: {
        API_STRICT_CORS: true,
        API_AUTH_TOKEN: 'test-lan-token',
        API_BIND_HOST: '0.0.0.0',
    },
}))

import {
    denyUnlessTrustedForLanMutation,
    denyVaultSecretCommandUnlessTrusted,
    isAllowedApiCorsOrigin,
    isApiAuthTokenValid,
    isApiLanMutationExemptPath,
    isLoopbackClient,
    isVaultDebugCommand,
    isVaultProtectedCommand,
    isVaultSecretCommand,
} from './api-security.js'

function mockReq(opts?: { ip?: string; host?: string }): http.IncomingMessage {
    return {
        socket: { remoteAddress: opts?.ip ?? '127.0.0.1' },
        headers: { host: opts?.host ?? '127.0.0.1:3342' },
    } as http.IncomingMessage
}

describe('api-security', () => {
    it('detects loopback clients', () => {
        expect(isLoopbackClient(mockReq({ ip: '127.0.0.1' }))).toBe(true)
        expect(isLoopbackClient(mockReq({ ip: '::1' }))).toBe(true)
        expect(isLoopbackClient(mockReq({ ip: '192.168.1.50' }))).toBe(false)
    })

    it('blocks cross-LAN CORS in strict mode', () => {
        const req = mockReq({ host: '192.168.1.50:3342' })
        expect(isAllowedApiCorsOrigin('http://192.168.1.50:3341', req)).toBe(true)
        expect(isAllowedApiCorsOrigin('http://192.168.1.99:8080', req)).toBe(false)
    })

    it('identifies vault secret commands', () => {
        expect(isVaultSecretCommand('/vault-show-signer-import')).toBe(true)
        expect(isVaultSecretCommand('/fetch')).toBe(false)
    })

    it('identifies vault debug commands as protected', () => {
        expect(isVaultDebugCommand('/vault-debug-chain')).toBe(true)
        expect(isVaultProtectedCommand('/vault-list-chain')).toBe(true)
        expect(isVaultProtectedCommand('/fetch')).toBe(false)
    })

    it('denies vault secret commands from untrusted LAN clients', () => {
        const req = {
            socket: { remoteAddress: '192.168.1.99' },
            headers: {},
        } as http.IncomingMessage
        let status = 0
        let body: { error?: string } = {}
        const res = {
            writeHead: (s: number) => {
                status = s
            },
            end: (json: string) => {
                body = JSON.parse(json)
            },
        } as unknown as ServerResponse
        const denied = denyVaultSecretCommandUnlessTrusted('/vault-ecdh-jwk', req, res, {}, (r, s, d) => {
            status = s
            body = d as { error?: string }
            r.end(JSON.stringify(d))
        })
        expect(denied).toBe(true)
        expect(status).toBe(403)
        expect(body.error).toMatch(/API_AUTH_TOKEN/i)
    })

    it('accepts vault secret commands with valid API token', () => {
        const req = {
            socket: { remoteAddress: '192.168.1.50' },
            headers: { authorization: 'Bearer test-lan-token' },
        } as http.IncomingMessage
        expect(isApiAuthTokenValid(req)).toBe(true)
        const denied = denyVaultSecretCommandUnlessTrusted(
            '/vault-ecdh-jwk',
            req,
            {} as ServerResponse,
            {},
            () => {}
        )
        expect(denied).toBe(false)
    })

    it('denies LAN mutations without token when API binds externally', () => {
        const req = {
            method: 'POST',
            socket: { remoteAddress: '192.168.1.50' },
            headers: {},
        } as http.IncomingMessage
        let status = 0
        const res = {
            writeHead: (s: number) => {
                status = s
            },
            end: () => {},
        } as unknown as ServerResponse
        const denied = denyUnlessTrustedForLanMutation(req, res, '/api/unlock', {}, (r, s) => {
            status = s
            r.end('{}')
        })
        expect(denied).toBe(true)
        expect(status).toBe(403)
    })

    it('allows LAN mutations with valid API token', () => {
        const req = {
            method: 'POST',
            socket: { remoteAddress: '192.168.1.50' },
            headers: { authorization: 'Bearer test-lan-token' },
        } as http.IncomingMessage
        const denied = denyUnlessTrustedForLanMutation(req, {} as ServerResponse, '/api/command', {}, () => {})
        expect(denied).toBe(false)
    })

    it('allows GET on LAN without token', () => {
        const req = {
            method: 'GET',
            socket: { remoteAddress: '192.168.1.50' },
            headers: {},
        } as http.IncomingMessage
        const denied = denyUnlessTrustedForLanMutation(req, {} as ServerResponse, '/api/status', {}, () => {})
        expect(denied).toBe(false)
    })

    it('exempts third-party webhooks from LAN mutation auth', () => {
        expect(isApiLanMutationExemptPath('/api/shop/webhook/stripe')).toBe(true)
        const req = {
            method: 'POST',
            socket: { remoteAddress: '203.0.113.1' },
            headers: {},
        } as http.IncomingMessage
        const denied = denyUnlessTrustedForLanMutation(
            req,
            {} as ServerResponse,
            '/api/integrations/telegram/webhook',
            {},
            () => {}
        )
        expect(denied).toBe(false)
    })

    it('warns when LAN API has no auth token configured', async () => {
        vi.resetModules()
        vi.doMock('../../config.js', () => ({
            CFG: { API_BIND_HOST: '0.0.0.0', API_AUTH_TOKEN: undefined },
        }))
        const { warnIfLanApiMissingAuthToken: warn } = await import('./api-security.js')
        const warnings: string[] = []
        warn((msg) => warnings.push(msg))
        expect(warnings.some((w) => /API_AUTH_TOKEN/i.test(w))).toBe(true)
        vi.resetModules()
        vi.doMock('../../config.js', () => ({
            CFG: {
                API_STRICT_CORS: true,
                API_AUTH_TOKEN: 'test-lan-token',
                API_BIND_HOST: '0.0.0.0',
            },
        }))
    })
})
