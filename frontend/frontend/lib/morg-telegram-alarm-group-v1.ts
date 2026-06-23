'use client'

/**
 * Wire `MORG_TELEGRAM_ALARM_GROUP_V1` — B4b / § H.36 P1.
 * @see docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md §3.5
 */

export const MORG_TELEGRAM_ALARM_GROUP_V1_PREFIX = '[[MORG_TELEGRAM_ALARM_GROUP_V1:' as const
const CLOSE = ']]' as const

export type TelegramAlarmGroupWireKind = 'invite_link' | 'revoke_hint'

export type MorgTelegramAlarmGroupV1 = {
  v: 1
  kind: TelegramAlarmGroupWireKind
  tgSeq: number
  teamId: string
  boss: string
  issuedAt: number
  label?: string
  inviteLink?: string
  sig?: string
}

export function buildMorgTelegramAlarmGroupV1Marker(payload: MorgTelegramAlarmGroupV1): string {
  return `${MORG_TELEGRAM_ALARM_GROUP_V1_PREFIX}${JSON.stringify(payload)}${CLOSE}`
}

export function parseMorgTelegramAlarmGroupV1(plaintext: string): MorgTelegramAlarmGroupV1 | null {
  const text = (plaintext || '').trim()
  const idx = text.indexOf(MORG_TELEGRAM_ALARM_GROUP_V1_PREFIX)
  if (idx < 0) return null
  const start = idx + MORG_TELEGRAM_ALARM_GROUP_V1_PREFIX.length
  const closeIdx = text.indexOf(CLOSE, start)
  if (closeIdx < 0) return null
  try {
    const o = JSON.parse(text.slice(start, closeIdx)) as MorgTelegramAlarmGroupV1
    if (o?.v !== 1) return null
    if (o.kind !== 'invite_link' && o.kind !== 'revoke_hint') return null
    if (!Number.isFinite(o.tgSeq) || !o.teamId?.trim() || !o.boss?.trim()) return null
    if (o.kind === 'invite_link' && !o.inviteLink?.trim()) return null
    return o
  } catch {
    return null
  }
}
