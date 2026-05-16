'use client'

import { useCallback, useRef, type ReactNode } from 'react'
import { Lock, MoreVertical, Radio, Star, Wifi } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { formatContactLastSeen, maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

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
  onRecordContact: () => void
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
    onRecordContact,
  } = props

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
      onClick={() => {
        onRecordContact()
      }}
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
              <h3 className="truncate text-lg font-bold leading-tight text-foreground">{displayName}</h3>
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
                <DropdownMenuItem onClick={onShowQr}>QR-Code anzeigen</DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>Bearbeiten / Mailbox</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onRemove}>
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

          <p className="mt-2 text-xs text-muted-foreground">
            Zuletzt: <span className="text-foreground/90">{formatContactLastSeen(lastSeen)}</span>
          </p>
        </div>
      </div>
    </article>
  )
}
