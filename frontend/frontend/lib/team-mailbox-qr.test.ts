import { describe, expect, it } from 'vitest'
import { buildTeamMailboxQrPayload, parseTeamMailboxQrPayload } from './team-mailbox-qr'

const ID = '0x' + 'a'.repeat(64)

describe('team-mailbox-qr', () => {
    it('roundtrip tm payload', () => {
        const raw = buildTeamMailboxQrPayload(ID, 'THW Alpha')
        const p = parseTeamMailboxQrPayload(raw)
        expect(p?.objectId).toBe(ID.toLowerCase())
        expect(p?.label).toBe('THW Alpha')
        expect(p?.source).toBe('tm')
    })

    it('plain hex', () => {
        const p = parseTeamMailboxQrPayload(ID)
        expect(p?.objectId).toBe(ID.toLowerCase())
        expect(p?.source).toBe('plain')
    })
})
