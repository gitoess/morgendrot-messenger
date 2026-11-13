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
            <p className="text-sm font-semibold text-foreground">
              Nach IOTA-Chat: Telegram-Push an Kontakt
            </p>
            <Switch
              checked={on}
              onCheckedChange={(v) => {
                writeTelegramNotifyOnSend(v)
                setOn(v)
              }}
              aria-label="Nach IOTA-Chat Telegram-Push an Kontakt"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Kurz-Hinweis nach IOTA-Send (Telegram-ID im Telefonbuch). Kein Chat-Ersatz, kein E2EE über TG.
            An = nach erfolgreichem 1:1-IOTA-Send Push an den Kontakt (Telegram-ID muss im Telefonbuch
            stehen). Aus = kein Push. Composer-Tab „telegram“ sendet direkt über Telegram — das ist ein anderer
            Kanal.
          </p>
        </div>
      </div>
    </div>
  )
}
