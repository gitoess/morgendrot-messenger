'use client'

/**
 * Wire `MORG_TEAM_MEMBER_UPDATE_V1` — § H.36 P1.
 * @see docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md §3.1
 */

export const MORG_TEAM_MEMBER_UPDATE_V1_PREFIX = '[[MORG_TEAM_MEMBER_UPDATE_V1:' as const
const CLOSE = ']]' as const

export type TeamMemberUpdateKind = 'add' | 'update' | 'remove'

export type TeamMemberWireMember = {
  address: string
  name: string
  roleTags?: string[]
  meshNodeId?: string
  telegramChatId?: string
  roleId?: number
  handoffLabel?: string
}

export type MorgTeamMemberUpdateV1 = {
  v: 1
  kind: TeamMemberUpdateKind
  seq: number
  teamId: string
  boss: string
  issuedAt: number
  member: TeamMemberWireMember
  sig?: string
}

export function buildMorgTeamMemberUpdateV1Marker(payload: MorgTeamMemberUpdateV1): string {
  return `${MORG_TEAM_MEMBER_UPDATE_V1_PREFIX}${JSON.stringify(payload)}${CLOSE}`
}

export function parseMorgTeamMemberUpdateV1(plaintext: string): MorgTeamMemberUpdateV1 | null {
  const text = (plaintext || '').trim()
  const idx = text.indexOf(MORG_TEAM_MEMBER_UPDATE_V1_PREFIX)
  if (idx < 0) return null
  const start = idx + MORG_TEAM_MEMBER_UPDATE_V1_PREFIX.length
  const closeIdx = text.indexOf(CLOSE, start)
  if (closeIdx < 0) return null
  try {
    const o = JSON.parse(text.slice(start, closeIdx)) as MorgTeamMemberUpdateV1
    if (o?.v !== 1) return null
    if (o.kind !== 'add' && o.kind !== 'update' && o.kind !== 'remove') return null
    if (!Number.isFinite(o.seq) || !o.teamId?.trim() || !o.boss?.trim()) return null
    if (!o.member?.address?.trim() || (o.kind !== 'remove' && !o.member?.name?.trim())) return null
    return o
  } catch {
    return null
  }
}

export function memberToInitialProfileContact(member: TeamMemberWireMember): Record<string, unknown> {
  const contact: Record<string, unknown> = {
    name: member.name,
    address: member.address,
  }
  if (member.roleTags?.length) contact.roleTags = member.roleTags
  if (member.meshNodeId?.trim()) contact.meshNodeId = member.meshNodeId.trim()
  if (member.telegramChatId?.trim()) contact.telegramChatId = member.telegramChatId.trim()
  if (member.roleId != null) contact.roleId = member.roleId
  return contact
}
