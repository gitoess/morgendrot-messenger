/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import type { IncomingMessage } from 'node:http'
import {
    assertBossSignerSafeAddress,
    isBossSignerAddressAllowed,
    isBossSignerTokenValid,
    isTimingSafeTokenMatch,
    parseBossSignerAllowedAddresses,
    validateBossSignerSignBody,
    validateBossSignerTokenConfig,
} from './boss-signer-lib.js'

describe('boss-signer-lib', () => {
    it('rejects short or missing token unless insecure dev', () => {
        expect(validateBossSignerTokenConfig('', false)).toMatch(/fehlt/)
        expect(validateBossSignerTokenConfig('short', false)).toMatch(/zu kurz/)
        expect(validateBossSignerTokenConfig('a'.repeat(16), false)).toBeNull()
        expect(validateBossSignerTokenConfig('', true)).toMatch(/ALLOW_INSECURE/)
    })

    it('uses timing-safe token compare', () => {
        expect(isTimingSafeTokenMatch('abc', 'abc')).toBe(true)
        expect(isTimingSafeTokenMatch('abc', 'abd')).toBe(false)
        const req = {
            headers: { authorization: 'Bearer ' + 'x'.repeat(16) },
        } as IncomingMessage
        expect(isBossSignerTokenValid(req, 'x'.repeat(16))).toBe(true)
    })

    it('validates addresses and allowlist', () => {
        const addr = '0x' + 'a'.repeat(64)
        expect(() => assertBossSignerSafeAddress(addr)).not.toThrow()
        const allowed = parseBossSignerAllowedAddresses(addr)
        expect(isBossSignerAddressAllowed(addr, allowed)).toBe(true)
        expect(isBossSignerAddressAllowed('0x' + 'b'.repeat(64), allowed)).toBe(false)
        expect(isBossSignerAddressAllowed(addr, new Set())).toBe(true)
    })

    it('rejects password in sign body', () => {
        const addr = '0x' + 'c'.repeat(64)
        expect(() =>
            validateBossSignerSignBody({
                address: addr,
                txBytesBase64: Buffer.from('tx').toString('base64'),
                password: 'secret',
            })
        ).toThrow(/Passwort/)
    })

    it('accepts valid sign body', () => {
        const addr = '0x' + 'd'.repeat(64)
        const b64 = Buffer.from('abcd').toString('base64')
        const r = validateBossSignerSignBody({ address: addr, txBytesBase64: b64 })
        expect(r.address).toBe(addr)
        expect(r.txBytesBase64).toBe(b64)
    })
})
