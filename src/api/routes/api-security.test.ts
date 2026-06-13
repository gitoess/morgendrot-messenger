/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'
import type http from 'node:http'

vi.mock('../../config.js', () => ({
    CFG: {
        API_STRICT_CORS: true,
    },
}))

import { isAllowedApiCorsOrigin, isLoopbackClient, isVaultSecretCommand } from './api-security.js'

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
})
