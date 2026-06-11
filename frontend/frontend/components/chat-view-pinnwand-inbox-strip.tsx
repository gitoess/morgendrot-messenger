'use client'

import { Megaphone } from 'lucide-react'
import type { Message } from '@/frontend/lib/types'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { ApiStatus } from '@/frontend/lib/api/status'
import {
  formatPinnwandMessageTime,
  pinnwandSenderDisplayLabel,
} from '@/frontend/lib/pinnwand-display'

/** Lagebild-Vorschau oben im 1:1 — letzte Posts, Signal-Farben, ohne technische Adressen. */
export function ChatViewPinnwandInboxStrip(p: {
  messages: Message[]
  role?: string
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  unreadCount?: number
  onOpenFullPinnwand?: () => void
}) {
  const recent = p.messages.slice(0, 3)
  if (recent.length === 0) return null

  const unread = p.unreadCount ?? 0

  return (
    <section
      className="mb-4 rounded-xl border-2 border-orange-500/50 bg-gradient-to-br from-orange-500/15 to-red-500/10 px-3 py-3 shadow-sm"
      aria-label="Offizielle Pinnwand"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
          <Megaphone className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-300" aria-hidden />
          Offizielle Pinnwand
          {unread > 0 ? (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
              {unread > 99 ? '99+' : unread} neu
            </span>
          ) : null}
        </div>
        {p.onOpenFullPinnwand ? (
          <button
            type="button"
            onClick={p.onOpenFullPinnwand}
            className="shrink-0 rounded-md border border-orange-500/40 bg-background/80 px-2 py-1 text-[11px] font-semibold text-orange-800 hover:bg-orange-500/10 dark:text-orange-100"
          >
            Alle anzeigen
          </button>
        ) : null}
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Meldungen der Führung — nur lesen.
      </p>
      <ul className="space-y-2">
        {recent.map((m) => {
          const from = (m.from ?? '').trim()
          const label = pinnwandSenderDisplayLabel(p.role, p.apiStatus ?? null, from, p.contactDirectory)
          const preview = (m.content ?? '').trim().slice(0, 160) || '(Anhang)'
          const time = formatPinnwandMessageTime(m.timestamp)
          return (
            <li
              key={m.id}
              className="rounded-lg border border-orange-500/30 bg-background/80 px-2.5 py-2 text-xs"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-semibold text-foreground">{label}</div>
                {time ? (
                  <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{time}</time>
                ) : null}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{preview}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
