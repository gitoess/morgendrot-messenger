/** Boss-Roster Pending (Handoff-Vorschlag + Beitrittsanfrage) — serverseitig, § H.36 P1. */

export const ROSTER_PENDING_VERSION = 1 as const;
export const ROSTER_PENDING_MAX_ENTRIES = 200;
export const ROSTER_PENDING_MAX_WIRE_NOTE = 500;

export type RosterPendingKind = 'handoff' | 'join_request';
export type RosterPendingStatus = 'pending' | 'approved' | 'dismissed' | 'rejected';

export type RosterPendingMember = {
    address: string;
    name: string;
    roleTags?: string[];
    meshNodeId?: string;
    telegramChatId?: string;
    roleId?: number;
    handoffLabel?: string;
};

export type RosterPendingEntry = {
    id: string;
    kind: RosterPendingKind;
    status: RosterPendingStatus;
    member: RosterPendingMember;
    createdAt: number;
    updatedAt: number;
    handoffLabel?: string;
    registryEntryId?: string;
    requestId?: string;
    boss?: string;
    teamId?: string;
    note?: string;
    issuedAt?: number;
};

export type RosterPendingStoreFile = {
    version: typeof ROSTER_PENDING_VERSION;
    entries: RosterPendingEntry[];
};

function isAddr64(s: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test((s || '').trim());
}

function trimMember(raw: unknown): RosterPendingMember | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const address = String(o.address ?? '').trim();
    const name = String(o.name ?? '').trim().slice(0, 120);
    if (!isAddr64(address) || !name) return null;
    const member: RosterPendingMember = { address: address.toLowerCase(), name };
    if (Array.isArray(o.roleTags)) {
        const tags = o.roleTags.map((t) => String(t).trim().slice(0, 48)).filter(Boolean).slice(0, 20);
        if (tags.length) member.roleTags = tags;
    }
    if (o.meshNodeId != null && String(o.meshNodeId).trim()) member.meshNodeId = String(o.meshNodeId).trim();
    if (o.telegramChatId != null && String(o.telegramChatId).trim()) {
        member.telegramChatId = String(o.telegramChatId).trim();
    }
    if (typeof o.roleId === 'number' && Number.isFinite(o.roleId)) member.roleId = o.roleId;
    if (o.handoffLabel != null && String(o.handoffLabel).trim()) {
        member.handoffLabel = String(o.handoffLabel).trim().slice(0, 64);
    }
    return member;
}

export function parseRosterPendingUpsert(raw: unknown):
    | { ok: true; entry: Omit<RosterPendingEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string } }
    | { ok: false; error: string } {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body muss ein Objekt sein.' };
    const o = raw as Record<string, unknown>;
    const kind = o.kind;
    if (kind !== 'handoff' && kind !== 'join_request') {
        return { ok: false, error: 'kind muss handoff oder join_request sein.' };
    }
    const member = trimMember(o.member);
    if (!member) return { ok: false, error: 'member.address (0x+64) und member.name erforderlich.' };
    const id = o.id != null ? String(o.id).trim().slice(0, 80) : undefined;
    const requestId = o.requestId != null ? String(o.requestId).trim().slice(0, 80) : undefined;
    if (kind === 'join_request' && !requestId) {
        return { ok: false, error: 'requestId erforderlich für join_request.' };
    }
    const note = o.note != null ? String(o.note).trim().slice(0, ROSTER_PENDING_MAX_WIRE_NOTE) : undefined;
    return {
        ok: true,
        entry: {
            ...(id ? { id } : {}),
            kind,
            member,
            ...(o.handoffLabel != null ? { handoffLabel: String(o.handoffLabel).trim().slice(0, 64) } : {}),
            ...(o.registryEntryId != null ? { registryEntryId: String(o.registryEntryId).trim().slice(0, 80) } : {}),
            ...(requestId ? { requestId } : {}),
            ...(o.boss != null && isAddr64(String(o.boss)) ? { boss: String(o.boss).trim().toLowerCase() } : {}),
            ...(o.teamId != null ? { teamId: String(o.teamId).trim().slice(0, 64) } : {}),
            ...(note ? { note } : {}),
            ...(typeof o.issuedAt === 'number' && Number.isFinite(o.issuedAt) ? { issuedAt: o.issuedAt } : {}),
        },
    };
}
