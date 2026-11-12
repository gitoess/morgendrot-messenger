import { describe, expect, it, beforeEach } from 'vitest'
import {
  confirmTelegramAlarmGroupJoined,
  readAppliedTelegramGroupTgSeq,
  readTelegramAlarmGroupMembership,
  saveTelegramAlarmGroupMembershipChatId,
  saveTelegramAlarmGroupPending,
  shouldShowTelegramAlarmGroupInvite,
} from '@/frontend/lib/telegram-alarm-group-prefs'

describe('telegram-alarm-group chat id', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('speichert Chat-ID nach Beitritt', () => {
    confirmTelegramAlarmGroupJoined({ inviteLink: 'https://t.me/+abc', label: 'Team' })
    const res = saveTelegramAlarmGroupMembershipChatId('-100999888')
    expect(res.ok).toBe(true)
    expect(readTelegramAlarmGroupMembership()?.groupChatId).toBe('-100999888')
  })

  it('lehnt leere ID ab', () => {
    confirmTelegramAlarmGroupJoined({ inviteLink: 'https://t.me/+abc' })
    expect(saveTelegramAlarmGroupMembershipChatId('').ok).toBe(false)
  })

  it('Beitritt markiert pending tgSeq applied und versteckt Invite', () => {
    saveTelegramAlarmGroupPending({
      inviteLink: 'https://t.me/+abc',
      label: 'Einsatz',
      tgSeq: 3,
    })
    expect(shouldShowTelegramAlarmGroupInvite({ tgSeq: 3, inviteLink: 'https://t.me/+abc' })).toBe(
      true
    )
    confirmTelegramAlarmGroupJoined({ inviteLink: 'https://t.me/+abc', label: 'Einsatz' })
    expect(readAppliedTelegramGroupTgSeq()).toBe(3)
    expect(shouldShowTelegramAlarmGroupInvite({ tgSeq: 3, inviteLink: 'https://t.me/+abc' })).toBe(
      false
    )
  })
})
