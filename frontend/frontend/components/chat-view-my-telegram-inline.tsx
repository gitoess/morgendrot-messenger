'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { fetchTelegramIntegration, type TelegramIntegrationPublic } from '@/frontend/lib/api/telegram-integrations'
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
  const [integration, setIntegration] = useState<TelegramIntegrationPublic | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchTelegramIntegration().then((res) => {
      if (!cancelled && res.ok) setIntegration(res)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const myTg = p.myTelegramChatId?.trim() || ''
  const botUserId = integration?.botUserId?.trim() || ''
  const groupId = integration?.einsatzGroupChatId?.trim() || ''
  const groupLabel = integration?.einsatzGroupLabel?.trim() || ''
  const inviteLink = integration?.einsatzGroupInviteLink?.trim() || ''

  const hasTeamMeta = Boolean(integration?.enabled && (botUserId || groupId || inviteLink))
  const hasAnything = Boolean(myTg || hasTeamMeta)

  if (!hasAnything) return null

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

      {myTg ? (
        <IdRow label="Meine Telegram Chat-ID" value={myTg} panel={panel} />
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Meine Chat-ID: nicht im Telefonbuch — unter Kontakt „Ich“ eintragen für 1:1-Hinweise.
        </p>
      )}

      {botUserId ? (
        <IdRow
          label="Boss-Bot-ID"
          value={botUserId}
          hint="Numerische Bot-ID (nicht deine Chat-ID)"
          panel={panel}
        />
      ) : null}

      {groupId || groupLabel ? (
        <IdRow
          label="Einsatz-Alarmgruppe"
          value={groupLabel ? `${groupLabel}${groupId ? ` (${groupId})` : ''}` : groupId}
          panel={panel}
        />
      ) : null}

      {inviteLink ? (
        <button
          type="button"
          className={
            panel
              ? 'inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted'
              : 'inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline'
          }
          onClick={() => window.open(inviteLink, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Alarmgruppe beitreten
        </button>
      ) : null}
    </div>
  )
}
