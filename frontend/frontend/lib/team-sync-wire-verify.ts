'use client'

import {
  verifyTeamWireSignature,
  type TeamWireSigVerifyResult,
} from '@morgendrot/shared/morg-team-wire-signature'
import type { MorgTeamMemberUpdateV1 } from '@/frontend/lib/morg-team-member-update-v1'
import type { MorgTelegramAlarmGroupV1 } from '@/frontend/lib/morg-telegram-alarm-group-v1'

export type TeamWireSigStatus = 'valid' | 'missing' | 'invalid' | 'boss-mismatch'

export function teamWireSigStatusFromVerify(r: TeamWireSigVerifyResult): TeamWireSigStatus {
  if (r.ok) return 'valid'
  if (r.reason === 'missing-sig') return 'missing'
  if (r.reason === 'boss-mismatch') return 'boss-mismatch'
  return 'invalid'
}

export async function resolveTeamMemberUpdateSigStatus(
  update: MorgTeamMemberUpdateV1
): Promise<TeamWireSigStatus> {
  return teamWireSigStatusFromVerify(await verifyTeamWireSignature(update))
}

export async function resolveTelegramAlarmGroupSigStatus(
  group: MorgTelegramAlarmGroupV1
): Promise<TeamWireSigStatus> {
  return teamWireSigStatusFromVerify(await verifyTeamWireSignature(group))
}

export function formatTeamWireSigStatusLine(status: TeamWireSigStatus): string | null {
  if (status === 'valid') return 'Boss-Signatur verifiziert'
  if (status === 'missing') return 'Signatur fehlt (Legacy-Wire — Vorsicht bei Übernahme)'
  if (status === 'boss-mismatch') return 'Signatur passt nicht zur Boss-Adresse im Wire'
  return 'Boss-Signatur ungültig — Übernahme blockiert'
}
