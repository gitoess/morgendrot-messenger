'use client'

/**
 * Team-Sync Wire veröffentlichen (IOTA Persistenz) — § H.36 P1/P3.
 * LAN-Zustellung folgt automatisch, wenn Basis-URL auf Boss-LAN zeigt.
 */
import { sendPlaintextMailboxHybrid, sendTeamPlaintextBroadcastHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import { getApiBase } from '@/frontend/lib/api/api-base'
import { postTeamSyncLanPush } from '@/frontend/lib/api/team-sync-lan'
import { isBossLanApiBase } from '@/frontend/lib/is-boss-lan-api-base'
import {
  buildMorgTeamMemberUpdateV1Marker,
  type MorgTeamMemberUpdateV1,
  type TeamMemberWireMember,
} from '@/frontend/lib/morg-team-member-update-v1'
import {
  buildMorgTelegramAlarmGroupV1Marker,
  type MorgTelegramAlarmGroupV1,
} from '@/frontend/lib/morg-telegram-alarm-group-v1'
import {
  buildMorgTeamJoinRequestV1Marker,
  newJoinRequestId,
  type MorgTeamJoinRequestV1,
} from '@/frontend/lib/morg-team-join-request-v1'
import {
  buildMorgTeamUpdatePingV1Marker,
  type MorgTeamUpdatePingV1,
} from '@/frontend/lib/morg-team-update-ping-v1'
import {
  enqueueTeamSyncItem,
  listTeamSyncQueueItems,
  removeTeamSyncQueueItem,
} from '@/frontend/lib/team-sync-offline-queue'
import { trySignTeamWirePayload } from '@/frontend/lib/team-sync-wire-sign'
import { postTelegramGroupAlarm } from '@/frontend/lib/api/telegram-integrations'

const LS_TEAM_SEQ = 'morgendrot.bossTeamUpdateSeq'
const LS_TG_SEQ = 'morgendrot.bossTelegramGroupTgSeq'

export function readBossTeamUpdateSeq(): number {
  if (typeof window === 'undefined') return 0
  try {
    const n = Number(window.localStorage.getItem(LS_TEAM_SEQ) || '0')
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function bumpBossTeamUpdateSeq(): number {
  const next = readBossTeamUpdateSeq() + 1
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LS_TEAM_SEQ, String(next))
    } catch {
      /* ignore */
    }
  }
  return next
}

export function readBossTelegramGroupTgSeq(): number {
  if (typeof window === 'undefined') return 0
  try {
    const n = Number(window.localStorage.getItem(LS_TG_SEQ) || '0')
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function bumpBossTelegramGroupTgSeq(): number {
  const next = readBossTelegramGroupTgSeq() + 1
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LS_TG_SEQ, String(next))
    } catch {
      /* ignore */
    }
  }
  return next
}

export type PublishWireResult = {
  ok: boolean
  error?: string
  channels?: { iota?: boolean; lan?: boolean; meshPing?: boolean }
  seq?: number
  tgSeq?: number
}

export type TeamSyncMeshPingSender = (text: string) => Promise<boolean>

export async function tryPublishTeamUpdatePingViaMesh(
  sendMeshText: TeamSyncMeshPingSender | undefined,
  payload: Omit<MorgTeamUpdatePingV1, 'v'>
): Promise<boolean> {
  if (!sendMeshText) return false
  try {
    const wire = buildMorgTeamUpdatePingV1Marker({ v: 1, ...payload })
    return await sendMeshText(wire)
  } catch {
    return false
  }
}

async function afterTeamSyncPublishSideEffects(opts: {
  meshPingSender?: TeamSyncMeshPingSender
  ping: Omit<MorgTeamUpdatePingV1, 'v'>
  telegramHint?: { eventType: 'team_update' | 'boss_alarm'; seq?: number; tgSeq?: number }
}): Promise<{ meshPing?: boolean }> {
  const channels: { meshPing?: boolean } = {}
  if (opts.meshPingSender) {
    channels.meshPing = await tryPublishTeamUpdatePingViaMesh(opts.meshPingSender, opts.ping)
  }
  if (opts.telegramHint) {
    void postTelegramGroupAlarm({
      eventType: opts.telegramHint.eventType,
      seq: opts.telegramHint.seq,
      tgSeq: opts.telegramHint.tgSeq,
    })
  }
  return channels
}

async function tryPublishTeamSyncLanPush(
  wire: string,
  opts: {
    teamMailboxAddress?: string
    teamId?: string
    seq?: number
    recipientAddresses?: string[]
  }
): Promise<boolean | undefined> {
  if (!isBossLanApiBase(getApiBase())) return undefined
  const r = await postTeamSyncLanPush({ wire, ...opts })
  return r.ok
}

export async function publishTeamMemberUpdateWire(opts: {
  teamMailboxAddress: string
  teamId: string
  bossAddress: string
  kind: MorgTeamMemberUpdateV1['kind']
  member: TeamMemberWireMember
  seq?: number
  meshPingSender?: TeamSyncMeshPingSender
  queueOnFailure?: boolean
  telegramGroupHint?: boolean
}): Promise<PublishWireResult> {
  const recipient = opts.teamMailboxAddress.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(recipient)) {
    return { ok: false, error: 'Team-Mailbox-Adresse (0x+64 Hex) fehlt oder ungültig.' }
  }
  const seq = opts.seq ?? bumpBossTeamUpdateSeq()
  const signed = await trySignTeamWirePayload({
    v: 1,
    kind: opts.kind,
    seq,
    teamId: opts.teamId.trim(),
    boss: opts.bossAddress.trim(),
    issuedAt: Date.now(),
    member: opts.member,
  })
  const payload: MorgTeamMemberUpdateV1 = signed as MorgTeamMemberUpdateV1
  const wire = buildMorgTeamMemberUpdateV1Marker(payload)
  const r = await sendTeamPlaintextBroadcastHybrid(recipient, wire, 0n)
  if (!r.ok) {
    if (opts.queueOnFailure !== false) {
      enqueueTeamSyncItem({
        kind: 'member_update',
        teamMailboxAddress: recipient,
        teamId: opts.teamId.trim(),
        bossAddress: opts.bossAddress.trim(),
        memberKind: opts.kind,
        member: opts.member as unknown as Record<string, unknown>,
      })
    }
    return { ok: false, error: r.error || 'IOTA-Send fehlgeschlagen', seq }
  }
  const side = await afterTeamSyncPublishSideEffects({
    meshPingSender: opts.meshPingSender,
    ping: { seq, teamId: opts.teamId.trim(), boss: opts.bossAddress.trim() },
    telegramHint: opts.telegramGroupHint
      ? { eventType: 'team_update', seq }
      : undefined,
  })
  const lan = await tryPublishTeamSyncLanPush(wire, {
    teamMailboxAddress: recipient,
    teamId: opts.teamId.trim(),
    seq,
  })
  return { ok: true, channels: { iota: true, ...(lan !== undefined ? { lan } : {}), meshPing: side.meshPing }, seq }
}

export async function publishTelegramAlarmGroupWire(opts: {
  teamMailboxAddress: string
  teamId: string
  bossAddress: string
  label?: string
  inviteLink: string
  tgSeq?: number
  meshPingSender?: TeamSyncMeshPingSender
  queueOnFailure?: boolean
  telegramGroupHint?: boolean
}): Promise<PublishWireResult> {
  const recipient = opts.teamMailboxAddress.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(recipient)) {
    return { ok: false, error: 'Team-Mailbox-Adresse (0x+64 Hex) fehlt oder ungültig.' }
  }
  const inviteLink = opts.inviteLink.trim()
  if (!inviteLink.startsWith('https://t.me/')) {
    return { ok: false, error: 'Einladungslink muss mit https://t.me/ beginnen.' }
  }
  const tgSeq = opts.tgSeq ?? bumpBossTelegramGroupTgSeq()
  const signed = await trySignTeamWirePayload({
    v: 1,
    kind: 'invite_link',
    tgSeq,
    teamId: opts.teamId.trim(),
    boss: opts.bossAddress.trim(),
    issuedAt: Date.now(),
    label: opts.label?.trim() || undefined,
    inviteLink,
  })
  const payload: MorgTelegramAlarmGroupV1 = signed as MorgTelegramAlarmGroupV1
  const wire = buildMorgTelegramAlarmGroupV1Marker(payload)
  const r = await sendTeamPlaintextBroadcastHybrid(recipient, wire, 0n)
  if (!r.ok) {
    if (opts.queueOnFailure !== false) {
      enqueueTeamSyncItem({
        kind: 'telegram_group',
        teamMailboxAddress: recipient,
        teamId: opts.teamId.trim(),
        bossAddress: opts.bossAddress.trim(),
        label: opts.label?.trim() || undefined,
        inviteLink,
      })
    }
    return { ok: false, error: r.error || 'IOTA-Send fehlgeschlagen', tgSeq }
  }
  const side = await afterTeamSyncPublishSideEffects({
    meshPingSender: opts.meshPingSender,
    ping: {
      tgSeq,
      teamId: opts.teamId.trim(),
      boss: opts.bossAddress.trim(),
      hint: 'telegram_group',
    },
    telegramHint: opts.telegramGroupHint ? { eventType: 'boss_alarm', tgSeq } : undefined,
  })
  const lan = await tryPublishTeamSyncLanPush(wire, {
    teamMailboxAddress: recipient,
    teamId: opts.teamId.trim(),
    seq: tgSeq,
  })
  return { ok: true, channels: { iota: true, ...(lan !== undefined ? { lan } : {}), meshPing: side.meshPing }, tgSeq }
}

export async function publishTeamJoinRequestWire(opts: {
  bossAddress: string
  applicant: MorgTeamJoinRequestV1['applicant']
  teamId?: string
  note?: string
  requestId?: string
}): Promise<PublishWireResult & { requestId?: string }> {
  const boss = opts.bossAddress.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(boss)) {
    return { ok: false, error: 'Boss-Adresse (0x+64 Hex) fehlt oder ungültig.' }
  }
  const requestId = opts.requestId ?? newJoinRequestId()
  const payload: MorgTeamJoinRequestV1 = {
    v: 1,
    requestId,
    applicant: opts.applicant,
    boss,
    issuedAt: Date.now(),
    ...(opts.teamId?.trim() ? { teamId: opts.teamId.trim() } : {}),
    ...(opts.note?.trim() ? { note: opts.note.trim().slice(0, 500) } : {}),
  }
  const wire = buildMorgTeamJoinRequestV1Marker(payload)
  const r = await sendPlaintextMailboxHybrid(boss, wire, 0n)
  if (!r.ok) return { ok: false, error: r.error || 'Join-Anfrage konnte nicht gesendet werden' }
  return { ok: true, channels: { iota: true }, requestId }
}

/** Boss-Offline-Queue leeren, wenn Basis wieder erreichbar (§ H.36 P3). */
export async function drainTeamSyncOfflineQueue(
  meshPingSender?: TeamSyncMeshPingSender
): Promise<{ drained: number; failed: number }> {
  let drained = 0
  let failed = 0
  for (const item of listTeamSyncQueueItems()) {
    if (item.kind === 'member_update') {
      const r = await publishTeamMemberUpdateWire({
        teamMailboxAddress: item.teamMailboxAddress,
        teamId: item.teamId,
        bossAddress: item.bossAddress,
        kind: item.memberKind,
        member: item.member as unknown as TeamMemberWireMember,
        queueOnFailure: false,
        meshPingSender,
        telegramGroupHint: true,
      })
      if (r.ok) {
        removeTeamSyncQueueItem(item.id)
        drained++
      } else {
        failed++
      }
    } else if (item.kind === 'telegram_group') {
      const r = await publishTelegramAlarmGroupWire({
        teamMailboxAddress: item.teamMailboxAddress,
        teamId: item.teamId,
        bossAddress: item.bossAddress,
        label: item.label,
        inviteLink: item.inviteLink,
        queueOnFailure: false,
        meshPingSender,
        telegramGroupHint: true,
      })
      if (r.ok) {
        removeTeamSyncQueueItem(item.id)
        drained++
      } else {
        failed++
      }
    }
  }
  return { drained, failed }
}
