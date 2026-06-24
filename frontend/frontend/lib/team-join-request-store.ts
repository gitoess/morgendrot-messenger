'use client'

import type { MorgTeamJoinRequestV1 } from '@/frontend/lib/morg-team-join-request-v1'
import { parseMorgTeamJoinRequestV1 } from '@/frontend/lib/morg-team-join-request-v1'

export type JoinRequestStatus = 'join_pending' | 'join_rejected' | 'join_approved'

export type StoredJoinRequest = MorgTeamJoinRequestV1 & {
  status: JoinRequestStatus
  messageId?: string
  receivedAtMs: number
}

const LS_PENDING = 'morgendrot.teamJoinRequests.pending.v1'
const LS_HELPER_SENT = 'morgendrot.teamJoinRequests.helperSent.v1'

export const TEAM_JOIN_REQUESTS_CHANGED_EVENT = 'morgendrot.teamJoinRequestsChanged' as const

function notifyChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TEAM_JOIN_REQUESTS_CHANGED_EVENT))
}

function readMap(): Record<string, StoredJoinRequest> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_PENDING)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, StoredJoinRequest>
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, StoredJoinRequest>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_PENDING, JSON.stringify(map))
  } catch {
    /* ignore */
  }
  notifyChanged()
}

export function upsertJoinRequestFromWire(
  wire: MorgTeamJoinRequestV1,
  opts?: { messageId?: string; skipServerSync?: boolean }
): void {
  const map = readMap()
  const prev = map[wire.requestId]
  if (prev?.status === 'join_approved' || prev?.status === 'join_rejected') return
  map[wire.requestId] = {
    ...wire,
    status: 'join_pending',
    messageId: opts?.messageId ?? prev?.messageId,
    receivedAtMs: prev?.receivedAtMs ?? Date.now(),
  }
  writeMap(map)
  if (!opts?.skipServerSync) {
    void import('@/frontend/lib/roster-pending-sync').then((m) =>
      m.syncJoinRequestToServer({
        requestId: wire.requestId,
        member: wire.applicant,
        boss: wire.boss,
        teamId: wire.teamId,
        note: wire.note,
        issuedAt: wire.issuedAt,
      })
    )
  }
}

export function listPendingJoinRequests(): StoredJoinRequest[] {
  return Object.values(readMap())
    .filter((r) => r.status === 'join_pending')
    .sort((a, b) => b.receivedAtMs - a.receivedAtMs)
}

export function getJoinRequest(requestId: string): StoredJoinRequest | null {
  return readMap()[requestId] ?? null
}

export function markJoinRequestStatus(requestId: string, status: JoinRequestStatus): void {
  const map = readMap()
  const hit = map[requestId]
  if (!hit) return
  map[requestId] = { ...hit, status }
  writeMap(map)
}

export function syncJoinRequestsFromInboxMessages(
  messages: ReadonlyArray<{ id: string; content?: string; recipient?: string; to?: string }>,
  bossAddress: string
): void {
  const boss = bossAddress.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/i.test(boss)) return
  for (const m of messages) {
    const parsed = parseMorgTeamJoinRequestV1(m.content ?? '')
    if (!parsed) continue
    if (parsed.boss.trim().toLowerCase() !== boss) continue
    upsertJoinRequestFromWire(parsed, { messageId: m.id })
  }
}

export function saveHelperSentJoinRequest(requestId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LS_HELPER_SENT)
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : []
    if (!list.includes(requestId)) list.push(requestId)
    window.localStorage.setItem(LS_HELPER_SENT, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function hasHelperSentJoinRequest(requestId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(LS_HELPER_SENT)
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : []
    return list.includes(requestId)
  } catch {
    return false
  }
}
