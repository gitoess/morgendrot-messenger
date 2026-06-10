'use client'

import { Megaphone } from 'lucide-react'
import type { Message } from '@/frontend/lib/types'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'

/** Helfer: letzte Pinnwand-Posts oben im 1:1-Posteingang (ohne eigenen Pinnwand-Tab). */
export function ChatViewPinnwandInboxStrip(p: {
  messages: Message[]
  contactDirectory?: Record<string, ContactMeshEntryClient>
  unreadCount?: number
  onSelectCategory?: () => void
}) {
  const recent = p.messages.slice(0, 3)
  if (recent.length === 0) return null

  return (
    <section
      className="mb-4 rounded-xl border-2 border-sky-500/40 bg-sky-500/10 px-3 py-3"
      aria-label="Lagebild Pinnwand"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Megaphone className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
          Lagebild
          {(p.unreadCount ?? 0) > 0 ? (
            <span className="min-w-[1.1rem] rounded-full bg-red-500 px-1.5 text-center text-[10px] font-semibold leading-4 text-white">
              {p.unreadCount! > 99 ? '99+' : p.unreadCount}
            </span>
          ) : null}
        </div>
        {p.onSelectCategory ? (
          <button
            type="button"
            onClick={p.onSelectCategory}
            className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-200"
          >
            Alle anzeigen
          </button>
        ) : null}
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Offizielle Meldungen der Führung — nur lesen.
      </p>
      <ul className="space-y-2">
        {recent.map((m) => {
          const from = (m.from ?? '').trim()
          const label = contactDisplayLabel(p.contactDirectory, from) || `${from.slice(0, 10)}…`
          const preview = (m.content ?? '').trim().slice(0, 160) || '(Anhang)'
          return (
            <li
              key={m.id}
              className="rounded-lg border border-sky-500/25 bg-background/70 px-2.5 py-2 text-xs"
            >
              <div className="font-medium text-foreground">{label}</div>
              <div className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{preview}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
