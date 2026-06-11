'use client'

import { Megaphone } from 'lucide-react'

/** Helfer: Kurzhinweis im Lagebild-Kanal (ohne technische Konfiguration). */
export function ChatViewPinnwandReaderBanner(p: { unreadCount?: number }) {
  const unread = p.unreadCount ?? 0
  return (
    <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2.5 text-sm text-orange-950 dark:text-orange-50/95">
      <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
        <Megaphone className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-300" aria-hidden />
        Offizielle Pinnwand
        {unread > 0 ? (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
            {unread > 99 ? '99+' : unread} neu
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Nur lesen — offizielle Pinnwand-Meldungen für alle im Einsatz (Klartext, nicht der normale Chat).
      </p>
    </div>
  )
}
