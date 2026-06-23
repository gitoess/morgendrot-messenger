import { describe, expect, it } from 'vitest'
import {
  buildMorgTeamMemberUpdateV1Marker,
  parseMorgTeamMemberUpdateV1,
} from '@/frontend/lib/morg-team-member-update-v1'
import {
  buildMorgTelegramAlarmGroupV1Marker,
  parseMorgTelegramAlarmGroupV1,
} from '@/frontend/lib/morg-telegram-alarm-group-v1'
import {
  buildMorgTeamJoinRequestV1Marker,
  parseMorgTeamJoinRequestV1,
} from '@/frontend/lib/morg-team-join-request-v1'
import {
  buildMorgTeamUpdatePingV1Marker,
  parseMorgTeamUpdatePingV1,
} from '@/frontend/lib/morg-team-update-ping-v1'
import { parseHandoffExtrasJson, buildHandoffExtrasJson } from '@/frontend/lib/handoff-extras'

const BOSS = '0x' + 'a'.repeat(64)
const ADDR = '0x' + 'b'.repeat(64)

describe('morg-team-member-update-v1', () => {
  it('roundtrip parse', () => {
    const wire = buildMorgTeamMemberUpdateV1Marker({
      v: 1,
      kind: 'add',
      seq: 3,
      teamId: 'alpha',
      boss: BOSS,
      issuedAt: 1,
      member: { address: ADDR, name: 'Medic' },
    })
    const parsed = parseMorgTeamMemberUpdateV1(wire)
    expect(parsed?.seq).toBe(3)
    expect(parsed?.member.name).toBe('Medic')
  })
})

describe('morg-telegram-alarm-group-v1', () => {
  it('roundtrip invite_link', () => {
    const wire = buildMorgTelegramAlarmGroupV1Marker({
      v: 1,
      kind: 'invite_link',
      tgSeq: 2,
      teamId: 'alpha',
      boss: BOSS,
      issuedAt: 1,
      inviteLink: 'https://t.me/+abc',
      label: 'Team',
    })
    const parsed = parseMorgTelegramAlarmGroupV1(wire)
    expect(parsed?.tgSeq).toBe(2)
    expect(parsed?.inviteLink).toBe('https://t.me/+abc')
  })
})

describe('morg-team-join-request-v1', () => {
  it('roundtrip parse', () => {
    const wire = buildMorgTeamJoinRequestV1Marker({
      v: 1,
      requestId: 'test-id',
      boss: BOSS,
      issuedAt: 1,
      applicant: { address: ADDR, name: 'Neuer Helfer' },
      note: 'Medic',
    })
    const parsed = parseMorgTeamJoinRequestV1(wire)
    expect(parsed?.applicant.name).toBe('Neuer Helfer')
    expect(parsed?.note).toBe('Medic')
  })
})

describe('morg-team-update-ping-v1', () => {
  it('roundtrip seq ping', () => {
    const wire = buildMorgTeamUpdatePingV1Marker({
      v: 1,
      seq: 42,
      teamId: 'alpha',
      boss: BOSS,
    })
    const parsed = parseMorgTeamUpdatePingV1(`Funk: ${wire} Ende`)
    expect(parsed?.seq).toBe(42)
    expect(parsed?.teamId).toBe('alpha')
  })

  it('roundtrip telegram_group hint', () => {
    const wire = buildMorgTeamUpdatePingV1Marker({
      v: 1,
      tgSeq: 5,
      teamId: 'alpha',
      boss: BOSS,
      hint: 'telegram_group',
    })
    const parsed = parseMorgTeamUpdatePingV1(wire)
    expect(parsed?.tgSeq).toBe(5)
    expect(parsed?.hint).toBe('telegram_group')
  })
})

describe('handoff-extras', () => {
  it('parses telegramAlarmGroup', () => {
    const json = buildHandoffExtrasJson({
      telegramAlarmGroup: { label: 'X', inviteLink: 'https://t.me/+x' },
    })
    const parsed = parseHandoffExtrasJson(json)
    expect(parsed?.telegramAlarmGroup?.inviteLink).toBe('https://t.me/+x')
  })
})
