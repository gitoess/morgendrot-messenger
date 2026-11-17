/**
 * Browser-seitige Telegram-Prefs leeren (Notfall-Löschung).
 */
import { clearTelegramAlarmGroupMembership } from '@/frontend/lib/telegram-alarm-group-prefs'
import { writeTelegramNotifyOnSend } from '@/frontend/lib/telegram-notify-pref'

const TELEGRAM_LS_KEYS = [
  'morgendrot.telegramAlarmGroupDismissed',
  'morgendrot.telegramOpenInviteOnStep',
  'morgendrot.telegramAlarmGroupPending',
  'morgendrot.telegramAlarmGroupJoinInitiated',
  'morgendrot.telegramAlarmGroupMembership',
  'morgendrot.appliedTelegramGroupTgSeq',
  'morgendrot.dismissedTelegramGroupTgSeq',
  'morgendrot.snoozedTelegramGroupCards',
  'morgendrot.telegramNotifyOnSend',
] as const

export function purgeTelegramBrowserPrefs(): number {
  if (typeof window === 'undefined') return 0
  let n = 0
  try {
    for (const key of TELEGRAM_LS_KEYS) {
      if (window.localStorage.getItem(key) != null) {
        window.localStorage.removeItem(key)
        n += 1
      }
    }
  } catch {
    /* ignore */
  }
  try {
    clearTelegramAlarmGroupMembership()
  } catch {
    /* ignore */
  }
  try {
    writeTelegramNotifyOnSend(false)
  } catch {
    /* ignore */
  }
  return n
}
