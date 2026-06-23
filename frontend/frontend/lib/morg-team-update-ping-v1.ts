'use client'

/**
 * Wire `MORG_TEAM_UPDATE_PING_V1` — Funk-Weckruf § H.36 P3.
 * @see docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md §3.4
 */

export const MORG_TEAM_UPDATE_PING_V1_PREFIX = '[[MORG_TEAM_UPDATE_PING_V1:' as const
const CLOSE = ']]' as const

export type TeamUpdatePingHint = 'telegram_group' | undefined

export type MorgTeamUpdatePingV1 = {
  v: 1
  seq?: number
  tgSeq?: number
  teamId: string
  boss: string
  hint?: TeamUpdatePingHint
}

export function buildMorgTeamUpdatePingV1Marker(payload: MorgTeamUpdatePingV1): string {
  return `${MORG_TEAM_UPDATE_PING_V1_PREFIX}${JSON.stringify(payload)}${CLOSE}`
}

export function parseMorgTeamUpdatePingV1(plaintext: string): MorgTeamUpdatePingV1 | null {
  const text = (plaintext || '').trim()
  const idx = text.indexOf(MORG_TEAM_UPDATE_PING_V1_PREFIX)
  if (idx < 0) return null
  const start = idx + MORG_TEAM_UPDATE_PING_V1_PREFIX.length
  const closeIdx = text.indexOf(CLOSE, start)
  if (closeIdx < 0) return null
  try {
    const o = JSON.parse(text.slice(start, closeIdx)) as MorgTeamUpdatePingV1
    if (o?.v !== 1) return null
    if (!o.teamId?.trim() || !o.boss?.trim()) return null
    return o
  } catch {
    return null
  }
}
