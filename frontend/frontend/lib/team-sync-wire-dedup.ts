'use client'

import { parseMorgTeamMemberUpdateV1 } from '@/frontend/lib/morg-team-member-update-v1'
import { parseMorgTelegramAlarmGroupV1 } from '@/frontend/lib/morg-telegram-alarm-group-v1'
import { parseMorgTeamUpdatePingV1 } from '@/frontend/lib/morg-team-update-ping-v1'

/** Dedup-Key für Team-Sync-Wires (LAN + spätere IOTA-Zeile mit gleichem Inhalt). */
export function resolveTeamSyncWireDedupKey(wire: string): string | undefined {
  const text = (wire || '').trim()
  const tu = parseMorgTeamMemberUpdateV1(text)
  if (tu) return `team-sync-v1|${tu.teamId}|${tu.seq}`
  const tg = parseMorgTelegramAlarmGroupV1(text)
  if (tg) return `team-sync-tg|${tg.teamId}|${tg.tgSeq}`
  const ping = parseMorgTeamUpdatePingV1(text)
  if (ping) {
    const n = ping.seq ?? ping.tgSeq ?? 0
    return `team-sync-ping|${ping.teamId}|${n}`
  }
  return undefined
}

/** Absender für LAN-Zeilen: Boss aus Wire-Metadaten (kein Chain-Signer). */
export function resolveTeamSyncWireBossAddress(wire: string): string {
  const text = (wire || '').trim()
  const tu = parseMorgTeamMemberUpdateV1(text)
  if (tu?.boss?.trim()) return tu.boss.trim()
  const tg = parseMorgTelegramAlarmGroupV1(text)
  if (tg?.boss?.trim()) return tg.boss.trim()
  const ping = parseMorgTeamUpdatePingV1(text)
  if (ping?.boss?.trim()) return ping.boss.trim()
  return ''
}
