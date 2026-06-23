'use client'

/**
 * Wire `MORG_TEAM_JOIN_REQUEST_V1` — § H.36 P2.
 * @see docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md §3.3
 */
import type { TeamMemberWireMember } from '@/frontend/lib/morg-team-member-update-v1'

export const MORG_TEAM_JOIN_REQUEST_V1_PREFIX = '[[MORG_TEAM_JOIN_REQUEST_V1:' as const
const CLOSE = ']]' as const

export type MorgTeamJoinRequestV1 = {
  v: 1
  requestId: string
  applicant: TeamMemberWireMember
  teamId?: string
  boss: string
  issuedAt: number
  note?: string
}

export function buildMorgTeamJoinRequestV1Marker(payload: MorgTeamJoinRequestV1): string {
  return `${MORG_TEAM_JOIN_REQUEST_V1_PREFIX}${JSON.stringify(payload)}${CLOSE}`
}

export function parseMorgTeamJoinRequestV1(plaintext: string): MorgTeamJoinRequestV1 | null {
  const text = (plaintext || '').trim()
  const idx = text.indexOf(MORG_TEAM_JOIN_REQUEST_V1_PREFIX)
  if (idx < 0) return null
  const start = idx + MORG_TEAM_JOIN_REQUEST_V1_PREFIX.length
  const closeIdx = text.indexOf(CLOSE, start)
  if (closeIdx < 0) return null
  try {
    const o = JSON.parse(text.slice(start, closeIdx)) as MorgTeamJoinRequestV1
    if (o?.v !== 1) return null
    if (!o.requestId?.trim() || !o.boss?.trim()) return null
    if (!o.applicant?.address?.trim() || !o.applicant?.name?.trim()) return null
    return o
  } catch {
    return null
  }
}

export function newJoinRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `jr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
