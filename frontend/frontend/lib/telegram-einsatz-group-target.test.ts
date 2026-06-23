import { describe, expect, it, vi } from 'vitest'
import {
  readTelegramEinsatzGroupSendRecipient,
  resolveTelegramAlarmGroupPartnerKey,
  resolveTelegramInviteLinkForHelper,
} from '@/frontend/lib/telegram-einsatz-group-target'

vi.mock('@/frontend/lib/handoff-extras', () => ({
  readTelegramInviteFromHandoffExtras: () => 'https://t.me/+handoff',
  readTelegramLabelFromHandoffExtras: () => 'Team Handoff',
}))

vi.mock('@/frontend/lib/telegram-alarm-group-prefs', () => ({
  readTelegramAlarmGroupPending: () => null,
  readTelegramAlarmGroupMembership: () => ({ inviteLink: 'https://t.me/+x', groupChatId: '-100555', confirmedAtMs: 1 }),
}))

describe('telegram-einsatz-group-target', () => {
  it('liefert tg:-Empfänger für Alarmgruppe', () => {
    expect(
      readTelegramEinsatzGroupSendRecipient({
        einsatzGroupAlarmEnabled: true,
        einsatzGroupChatId: '-100123',
      } as never)
    ).toBe('tg:-100123')
  })

  it('bevorzugt Handoff-Link für Helfer-Join', () => {
    expect(resolveTelegramInviteLinkForHelper(null)).toEqual({
      inviteLink: 'https://t.me/+handoff',
      label: 'Team Handoff',
    })
  })

  it('liefert Partner-Key aus API oder Membership', () => {
    expect(
      resolveTelegramAlarmGroupPartnerKey({
        einsatzGroupAlarmEnabled: true,
        einsatzGroupChatId: '-100123',
      } as never)
    ).toBe('tg:-100123')
    expect(resolveTelegramAlarmGroupPartnerKey(null)).toBe('tg:-100555')
  })
})
