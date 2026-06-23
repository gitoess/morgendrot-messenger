'use client'

/**
 * Telegram-Einladungslink öffnen (Web + tg:// Deep-Link) und Join-Status in Morgendrot setzen.
 * @see docs/TELEGRAM-INTEGRATION-ZIELBILD.md §6.6.1
 */
import { markTelegramAlarmGroupJoinInitiated } from '@/frontend/lib/telegram-alarm-group-prefs'

/** `https://t.me/+AbCd` → `tg://join?invite=AbCd` */
export function telegramInviteToDeepLink(inviteLink: string): string | null {
  const url = inviteLink.trim()
  const plus = url.match(/^https:\/\/t\.me\/\+([A-Za-z0-9_-]+)/i)
  if (plus?.[1]) return `tg://join?invite=${plus[1]}`
  const joinchat = url.match(/^https:\/\/t\.me\/joinchat\/([A-Za-z0-9_-]+)/i)
  if (joinchat?.[1]) return `tg://join?invite=${joinchat[1]}`
  return null
}

export type OpenTelegramAlarmGroupInviteResult = {
  opened: boolean
  deepLinkTried: boolean
}

export function openTelegramAlarmGroupInvite(inviteLink: string): OpenTelegramAlarmGroupInviteResult {
  const link = inviteLink.trim()
  if (!link) return { opened: false, deepLinkTried: false }

  markTelegramAlarmGroupJoinInitiated(link)

  const deep = telegramInviteToDeepLink(link)
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  if (isMobile && deep) {
    try {
      window.location.assign(deep)
      return { opened: true, deepLinkTried: true }
    } catch {
      /* fallback */
    }
  }

  const opened = window.open(link, '_blank', 'noopener,noreferrer')
  if (!opened && deep) {
    try {
      window.location.assign(deep)
      return { opened: true, deepLinkTried: true }
    } catch {
      /* fallback */
    }
  }
  return { opened: opened != null, deepLinkTried: false }
}
