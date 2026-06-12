import { describe, expect, it } from 'vitest'
import {
    parseEinsatzManifestAnchorsResponse,
    parseEinsatzManifestProbeResponse,
} from './einsatz-manifest-api'

describe('einsatz-manifest-api parsers', () => {
    it('parseEinsatzManifestAnchorsResponse lehnt ungültiges JSON ab', () => {
        const r = parseEinsatzManifestAnchorsResponse('not-json', 200)
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.error).toMatch(/JSON/)
    })

    it('parseEinsatzManifestAnchorsResponse parst rows', () => {
        const r = parseEinsatzManifestAnchorsResponse(
            JSON.stringify({
                ok: true,
                rows: [{ sequence: 1, einsatzIdMoveAddress: '0x' + 'a'.repeat(64) }],
            }),
            200
        )
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.rows).toHaveLength(1)
    })

    it('parseEinsatzManifestProbeResponse parst exists', () => {
        const r = parseEinsatzManifestProbeResponse(
            JSON.stringify({ ok: true, exists: true, sequence: 3 }),
            200,
            1
        )
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.exists).toBe(true)
            expect(r.sequence).toBe(3)
        }
    })

    it('parseEinsatzManifestProbeResponse HTTP 403', () => {
        const r = parseEinsatzManifestProbeResponse(JSON.stringify({ ok: false, error: 'nope' }), 403, 1)
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.httpStatus).toBe(403)
    })
})
