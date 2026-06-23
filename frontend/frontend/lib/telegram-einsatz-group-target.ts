'use client'

import type { TelegramIntegrationPublic } from '@/frontend/lib/api/telegram-integrations'
import {
  readTelegramInviteFromHandoffExtras,
  readTelegramLabelFromHandoffExtras,
} from '@/frontend/lib/handoff-extras'
import {
  readTelegramAlarmGroupMembership,
  readTelegramAlarmGroupPending,
} from '@/frontend/lib/telegram-alarm-group-prefs'

/** Composer-Ziel für Telegram „Alle“ = Einsatz-Alarmgruppe (B4b). */
export function readTelegramEinsatzGroupSendRecipient(
  integration?: TelegramIntegrationPublic | null
): string | null {
  if (!integration?.einsatzGroupAlarmEnabled) return null
  const chatId = integration.einsatzGroupChatId?.trim()
  if (!chatId || !/^-?\d{1,20}$/.test(chatId)) return null
  return `tg:${chatId}`
}

/** Posteingangs-/Composer-Schlüssel für die Einsatz-Alarmgruppe (`tg:-100…`). */
export function resolveTelegramAlarmGroupPartnerKey(
  integration?: TelegramIntegrationPublic | null
): string | null {
  const fromApi = readTelegramEinsatzGroupSendRecipient(integration)
  if (fromApi) return fromApi
  const m = readTelegramAlarmGroupMembership()
  const id = m?.groupChatId?.trim()
  return id ? `tg:${id}` : null
}

export function resolveTelegramInviteLinkForHelper(
  integration?: TelegramIntegrationPublic | null
): { inviteLink: string; label: string } {
  const inviteLink =
    readTelegramInviteFromHandoffExtras() ||
    readTelegramAlarmGroupPending()?.inviteLink?.trim() ||
    integration?.einsatzGroupInviteLink?.trim() ||
    ''
  const label =
    readTelegramLabelFromHandoffExtras() ||
    readTelegramAlarmGroupPending()?.label?.trim() ||
    integration?.einsatzGroupLabel?.trim() ||
    ''
  return { inviteLink, label }
}
