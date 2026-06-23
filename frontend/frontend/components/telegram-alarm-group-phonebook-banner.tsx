'use client'

import { MessageCircle, Check } from 'lucide-react'
import { readTelegramAlarmGroupMembership } from '@/frontend/lib/telegram-alarm-group-prefs'
import { TelegramAlarmGroupChatIdCapture } from '@/frontend/components/telegram-alarm-group-chat-id-capture'

/** Kompakter Status — Details im Handbuch / Sidebar „Einsatz-Alarmgruppe“. */
export function TelegramAlarmGroupPhonebookBanner() {
  const membership = readTelegramAlarmGroupMembership()
  if (!membership) return null
  const label = membership.label?.trim() || 'Einsatz-Alarmgruppe'
  const hasChatId = Boolean(membership.groupChatId?.trim())
  return (
    <div
      className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-sm"
      role="status"
    >
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <MessageCircle className="h-4 w-4 text-sky-400" aria-hidden />
        {label}
        <Check className="h-4 w-4 text-emerald-500" aria-hidden />
        <span className="sr-only">Beigetreten</span>
      </p>
      {!hasChatId ? <TelegramAlarmGroupChatIdCapture compact /> : null}
    </div>
  )
}
