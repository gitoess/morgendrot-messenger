/**
 * § H.22 / Spätere Tests #3 — Team-Mailbox per QR oder ID beitreten.
 */

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type MorgTeamMailboxQrV1 = {
    v: 1
    k: 'tm'
    /** Team-Mailbox Object-ID */
    id: string
    /** Anzeigename */
    n?: string
}

export type ParsedTeamMailboxQr = {
    objectId: string
    label?: string
    source: 'tm' | 'plain'
}

export function buildTeamMailboxQrPayload(objectId: string, label?: string): string {
    const id = objectId.trim()
    if (!HEX64.test(id)) throw new Error('Ungültige Team-Mailbox-ID.')
    const payload: MorgTeamMailboxQrV1 = {
        v: 1,
        k: 'tm',
        id: id.toLowerCase(),
        ...(label?.trim() ? { n: label.trim().slice(0, 80) } : {}),
    }
    return JSON.stringify(payload)
}

export function parseTeamMailboxQrPayload(raw: string): ParsedTeamMailboxQr | null {
    const t = raw.trim()
    if (!t) return null
    if (HEX64.test(t)) {
        return { objectId: t.toLowerCase(), source: 'plain' }
    }
    try {
        const j = JSON.parse(t) as Record<string, unknown>
        if (j.k === 'tm' && j.v === 1 && typeof j.id === 'string' && HEX64.test(j.id.trim())) {
            const label = typeof j.n === 'string' ? j.n.trim() : undefined
            return {
                objectId: j.id.trim().toLowerCase(),
                ...(label ? { label } : {}),
                source: 'tm',
            }
        }
        const altId =
            (typeof j.teamMailboxId === 'string' && j.teamMailboxId) ||
            (typeof j.team_mailbox_id === 'string' && j.team_mailbox_id) ||
            (typeof j.objectId === 'string' && j.objectId) ||
            ''
        if (HEX64.test(altId.trim())) {
            const label =
                (typeof j.label === 'string' && j.label.trim()) ||
                (typeof j.n === 'string' && j.n.trim()) ||
                undefined
            return {
                objectId: altId.trim().toLowerCase(),
                ...(label ? { label } : {}),
                source: 'tm',
            }
        }
    } catch {
        /* not JSON */
    }
    const embedded = t.match(/(0x[a-fA-F0-9]{64})/)
    if (embedded?.[1] && HEX64.test(embedded[1])) {
        return { objectId: embedded[1].toLowerCase(), source: 'plain' }
    }
    return null
}
