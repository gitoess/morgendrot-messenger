'use client'

import { useCallback, useRef, type ReactNode } from 'react'
import { Lock, MessageSquare, MoreVertical, Radio, Star, Users, Wifi, Check, UserMinus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { formatContactLastSeen, maskWalletAddress, normalizeContactRoleTags } from '@/frontend/lib/contact-phonebook-format'

export type ContactPhonebookCardProps = {
  address: string
  entry: ContactMeshEntryClient
  displayName: string
  isFavorite: boolean
  isOnline: boolean
  hasLora: boolean
  hasPrivateMailbox: boolean
  loraOnly: boolean
  lastSeen?: number
  expanded: boolean
  onToggleExpand: () => void
  onToggleFavorite: () => void
  onEdit: () => void
  onShowQr: () => void
  onRemove: () => void
  /** Boss/Kommandant: Team-Update kind=remove an alle Mitglieder. */
  onRemoveFromTeam?: () => void
  /** Entfernung bereits an Team gesendet. */
  teamRemoveSent?: boolean
  teamRemoveTick?: number
  onRecordContact: () => void
  /** Kontakt ins Composer übernehmen (eigener Button, nicht Kartenklick). */
  onSelectForMessenger?: () => void
}

function ReachBadge(p: {
  active: boolean
  label: string
  className: string
  icon: ReactNode
}) {
  const { active, label, className, icon } = p
  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        active ? className : 'border-border/60 bg-muted/20 text-muted-foreground opacity-45'
      )}
      title={label}
    >
      {icon}
      {label}
    </span>
  )
}

export function ContactPhonebookCard(props: ContactPhonebookCardProps) {
  const {
    address,
    entry,
    displayName,
    isFavorite,
    isOnline,
    hasLora,
    hasPrivateMailbox,
    loraOnly,
    lastSeen,
    expanded,
    onToggleExpand,
    onToggleFavorite,
    onEdit,
    onShowQr,
    onRemove,
    onRemoveFromTeam,
    teamRemoveSent,
    teamRemoveTick,
    onRecordContact,
    onSelectForMessenger,
  } = props

  void teamRemoveTick

  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  const startLongPress = useCallback(() => {
    clearLongPress()
    longPressRef.current = setTimeout(() => {
      onShowQr()
    }, 550)
  }, [onShowQr])

  const roleTags = normalizeContactRoleTags(entry.roleTags)
  const showTeamBadge = Boolean(onRemoveFromTeam || teamRemoveSent)

  return (
    <article
      className={cn(
        'rounded-xl border bg-card p-4 shadow-sm transition-colors',
        hasLora && 'border-emerald-500/25',
        isFavorite && 'ring-1 ring-amber-500/35',
        loraOnly && 'border-l-4 border-l-emerald-500'
      )}
      onContextMenu={(e) => {
        e.preventDefault()
        onEdit()
      }}
      onTouchStart={startLongPress}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onMouseDown={startLongPress}
      onMouseUp={clearLongPress}
      onMouseLeave={clearLongPress}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
          aria-label={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}
        >
          <Star
            className={cn('h-5 w-5', isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')}
          />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-bold leading-tight text-foreground">{displayName}</h3>
                {showTeamBadge ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-100">
                    <Users className="h-3 w-3" aria-hidden />
                    Team
                  </span>
                ) : null}
              </div>
              {roleTags.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {roleTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-violet-500/35 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-950 dark:text-violet-100"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand()
                }}
                className="mt-0.5 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                {expanded ? address : maskWalletAddress(address)}
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted"
                  aria-label="Kontakt-Menü"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    onShowQr()
                  }}
                >
                  QR-Code anzeigen
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    onEdit()
                  }}
                >
                  Bearbeiten / Mailbox
                </DropdownMenuItem>
                {onRemoveFromTeam ? (
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
                    onSelect={(e) => {
                      e.preventDefault()
                      onRemoveFromTeam()
                    }}
                  >
                    Aus Team entfernen
                  </DropdownMenuItem>
                ) : teamRemoveSent ? (
                  <DropdownMenuItem disabled className="text-emerald-600 dark:text-emerald-400">
                    <Check className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Aus Team entfernt
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault()
                    onRemove()
                  }}
                >
                  Aus Telefonbuch entfernen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {loraOnly ? (
            <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Nur per LoRa erreichbar (kein Online-Handshake)
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Erreichbarkeit
            </span>
            <ReachBadge
              active={hasLora}
              label="LoRa"
              className="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              icon={<span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
            />
            <ReachBadge
              active={isOnline}
              label="Online"
              className="border-sky-500/40 bg-sky-500/15 text-sky-800 dark:text-sky-200"
              icon={<Wifi className="h-3 w-3" aria-hidden />}
            />
            <ReachBadge
              active={hasPrivateMailbox}
              label="Private Mailbox"
              className="border-orange-500/40 bg-orange-500/15 text-orange-900 dark:text-orange-100"
              icon={<Lock className="h-3 w-3" aria-hidden />}
            />
          </div>

          {entry.meshNodeId?.trim() ? (
            <p className="mt-2 text-sm text-foreground">
              <Radio className="mr-1.5 inline h-3.5 w-3.5 text-emerald-500" aria-hidden />
              Meshtastic: <strong>{entry.meshNodeId.trim()}</strong>
            </p>
          ) : null}
          {entry.telegramChatId?.trim() ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Telegram: <span className="font-mono text-foreground">{entry.telegramChatId.trim()}</span>
            </p>
          ) : null}

          <p className="mt-2 text-xs text-muted-foreground">
            Zuletzt: <span className="text-foreground/90">{formatContactLastSeen(lastSeen)}</span>
          </p>

          {onSelectForMessenger ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRecordContact()
                onSelectForMessenger()
              }}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/15"
            >
              <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
              Im Messenger verwenden
            </button>
          ) : null}

          {onRemoveFromTeam ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveFromTeam()
              }}
              className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-sm font-medium text-rose-800 hover:bg-rose-500/15 dark:text-rose-200"
            >
              <UserMinus className="h-4 w-4 shrink-0" aria-hidden />
              Aus Team entfernen
            </button>
          ) : teamRemoveSent ? (
            <p className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Aus Team entfernt — Team wurde benachrichtigt
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
