'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  readTelegramNotifyOnSend,
  writeTelegramNotifyOnSend,
} from '@/frontend/lib/telegram-notify-pref'

export function SettingsTelegramNotifyOnSend() {
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(readTelegramNotifyOnSend())
  }, [])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Telegram notice after online send</p>
            <Switch
              checked={on}
              onCheckedChange={(v) => {
                writeTelegramNotifyOnSend(v)
                setOn(v)
              }}
              aria-label="Telegram notice after successful online send"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Off = no Telegram notice after IOTA send. Composer “telegram” tab is independent.
          </p>
        </div>
      </div>
    </div>
  )
}
