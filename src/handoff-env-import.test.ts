/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { HANDOFF_IMPORT_ALLOWLIST, previewHandoffEnvImport } from './handoff-env-import.js'

describe('handoff-env-import', () => {
    it('erlaubt API_AUTH_TOKEN im Allowlist', () => {
        expect(HANDOFF_IMPORT_ALLOWLIST.has('API_AUTH_TOKEN')).toBe(true)
    })

    it('importiert API_AUTH_TOKEN wenn Wert sicher', () => {
        const env = [
            'PACKAGE_ID=0x' + 'a'.repeat(64),
            'BOSS_ADDRESS=0x' + 'b'.repeat(64),
            'API_AUTH_TOKEN=lan-op-token-abc123',
        ].join('\n')
        const preview = previewHandoffEnvImport(env)
        expect(preview.ok).toBe(true)
        expect(preview.pairs?.API_AUTH_TOKEN).toBe('lan-op-token-abc123')
    })

    it('lehnt Werte mit sk_-Pattern ab', () => {
        const env = [
            'PACKAGE_ID=0x' + 'a'.repeat(64),
            'BOSS_ADDRESS=0x' + 'b'.repeat(64),
            'RPC_URL=https://example.com/sk_live_secret123',
        ].join('\n')
        const preview = previewHandoffEnvImport(env)
        expect(preview.ok).toBe(false)
        expect(preview.errors.some((e) => /RPC_URL/i.test(e))).toBe(true)
    })
})
