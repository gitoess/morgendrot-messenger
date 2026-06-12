'use client'

import { cn } from '@/lib/utils'
import {
  describeChainPersistenceRoute,
  type MessagingPersistenceMode,
} from '@/frontend/lib/messaging-persistence-mode'

export type ChatViewChainPersistenceBadgeProps = {
  mode: MessagingPersistenceMode
  encrypted: boolean
  className?: string
}

/** Zeigt Flüchtig (Event) vs. Persistent (Mailbox) beim Online-Senden. */
export function ChatViewChainPersistenceBadge(p: ChatViewChainPersistenceBadgeProps) {
  const route = describeChainPersistenceRoute(p.encrypted, p.mode)
  const isMailbox = p.mode === 'mailbox'

  return (
    <div
      role="status"
      className={cn(
        'rounded-md border px-2.5 py-1.5 text-[10px] leading-snug',
        isMailbox
          ? 'border-violet-500/35 bg-violet-500/10 text-violet-950 dark:text-violet-100'
          : 'border-sky-500/35 bg-sky-500/10 text-sky-950 dark:text-sky-100',
        p.className
      )}
    >
      <span className="font-semibold">{route.label}</span>
      <span className="text-muted-foreground"> — {route.detail}</span>
    </div>
  )
}
