'use client'

import { TelegramAlarmGroupJoinCard } from '@/frontend/components/telegram-alarm-group-join-card'

export function SettingsTelegramAlarmGroupJoin(p: { backendOnline: boolean }) {
  return <TelegramAlarmGroupJoinCard variant="settings" backendOnline={p.backendOnline} />
}
