'use client'

import { Info } from 'lucide-react'

export function ChatViewTelegramAlarmThreadBanner(p: {
  partnerKeyReady: boolean
}) {
  return (
    <div
      className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-sm"
      role="status"
    >
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <Info className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
        Telegram-Einsatz-Alarmgruppe
      </p>
      {!p.partnerKeyReady ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Die Gruppen-Chat-ID fehlt noch — der Boss muss unter Einstellungen → Telegram die
          Einsatz-Alarmgruppe mit Chat-ID (`-100…`) speichern. Dann kann der Thread hier Nachrichten
          anzeigen und der Composer die Gruppe ansprechen.
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Nachrichten aus der Telegram-Gruppe erscheinen hier, wenn der Morgendrot-Bot in der Gruppe
          ist, Einstellungen → Telegram → Eingang auf „Long Polling“ steht und der Bot Gruppennachrichten
          empfangen darf (BotFather: Privacy aus). Normale Chats in der Telegram-App laufen nicht
          automatisch in Morgendrot — nur was der Bot sieht.
        </p>
      )}
    </div>
  )
}
