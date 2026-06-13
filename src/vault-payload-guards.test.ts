/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { parseVaultKeysPayload } from './vault-payload-guards.js'

describe('vault-payload-guards', () => {
    it('parst gültiges Keys-Payload', () => {
        const pkcs8 = Buffer.from('pkcs8-bytes').toString('base64')
        const pubRaw = Buffer.alloc(65, 4).toString('base64')
        const json = JSON.stringify({ pkcs8, pubRaw, notes: '' })
        const parsed = parseVaultKeysPayload(json)
        expect(parsed.pkcs8).toBe(pkcs8)
        expect(parsed.pubRaw).toBe(pubRaw)
    })

    it('lehnt fehlende Felder ab', () => {
        expect(() => parseVaultKeysPayload('{}')).toThrow(/pkcs8/)
        expect(() => parseVaultKeysPayload('not-json')).toThrow(/JSON/)
    })
})
