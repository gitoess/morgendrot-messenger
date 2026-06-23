'use client'

import { TelegramAlarmGroupJoinCard } from '@/frontend/components/telegram-alarm-group-join-card'
import { cn } from '@/lib/utils'

export type ChatViewMyTelegramInlineProps = {
  /** Eigene Chat-ID aus Telefonbuch (1:1-Hinweise). */
  myTelegramChatId?: string | null
  variant?: 'compact' | 'panel'
  className?: string
}

function IdRow(p: { label: string; value: string; hint?: string; panel: boolean }) {
  if (!p.value) return null
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={p.panel ? 'text-xs font-semibold text-muted-foreground' : 'text-[10px] text-muted-foreground'}>
        {p.label}
      </span>
      <code
        className={cn(
          'truncate font-mono text-foreground',
          p.panel ? 'text-sm' : 'text-[10px] text-foreground/85'
        )}
        title={p.value}
      >
        {p.value}
      </code>
      {p.hint ? <span className="text-[10px] text-muted-foreground">{p.hint}</span> : null}
    </div>
  )
}

export function ChatViewMyTelegramInline(p: ChatViewMyTelegramInlineProps) {
  const panel = p.variant === 'panel'
  const myTg = p.myTelegramChatId?.trim() || ''

  if (!myTg) {
    return (
      <div
        className={cn(
          'flex min-w-0 flex-col gap-2 border-t border-border/50 pt-3',
          p.className
        )}
        aria-label="Telegram"
      >
        <span className={panel ? 'text-xs font-semibold text-muted-foreground' : 'text-[10px] text-muted-foreground'}>
          Telegram
        </span>
        <p className="text-[10px] text-muted-foreground">
          Meine Chat-ID: nicht im Telefonbuch — unter Kontakt „Ich“ eintragen für 1:1-Hinweise.
        </p>
        <TelegramAlarmGroupJoinCard variant="inline" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 border-t border-border/50 pt-3',
        p.className
      )}
      aria-label="Telegram"
    >
      <span className={panel ? 'text-xs font-semibold text-muted-foreground' : 'text-[10px] text-muted-foreground'}>
        Telegram
      </span>
      <IdRow label="Meine Telegram Chat-ID" value={myTg} panel={panel} />
      <TelegramAlarmGroupJoinCard variant="inline" />
    </div>
  )
}
