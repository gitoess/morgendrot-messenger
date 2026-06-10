'use client'

import { MessageCircle } from 'lucide-react'

export type InboxUnreadThreadOption = {
  address: string
  label: string
  unreadCount: number
}

/** Helfer/Simple: kompakte Liste offener 1:1-Threads mit Ungelesen-Badge. */
export function ChatViewInboxUnreadThreadsStrip(p: {
  threads: InboxUnreadThreadOption[]
  onOpenThread: (address: string) => void
}) {
  if (p.threads.length === 0) return null

  return (
    <section
      className="mb-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5"
      aria-label="Ungelesene Direkt-Chats"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        Offene Chats
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {p.threads.map((t) => (
          <li key={t.address}>
            <button
              type="button"
              onClick={() => p.onOpenThread(t.address)}
              className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
            >
              <span className="truncate">{t.label}</span>
              <span className="min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                {t.unreadCount > 99 ? '99+' : t.unreadCount}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
