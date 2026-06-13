'use client'

/**
 * Schnellfilter: Partner-Chips, Kanal (Eingang/Ausgang + Quelle), optional Inhalt (Klartext/Verschlüsselt).
 * Filter wirken nur wenn die jeweilige Toolbar-Sektion eingeschaltet ist (armed).
 */

import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { InboxDirectionFilter } from '@/frontend/features/inbox/inbox-partner-filter'
import type { InboxWireFilter } from '@/frontend/lib/inbox-wire-filter'
import { type InboxSourceFilter, inboxSourceFilterLabel } from '@/frontend/lib/inbox-source-filter'
import type { ApiStatus } from '@/frontend/lib/api'
import {
  inboxSourceFilterDeniedReason,
  inboxSourceFilterReadAllowed,
} from '@/frontend/lib/messenger-capability-gates'

export type InboxPartnerOption = { address: string; label: string; unreadCount?: number }

const MAX_VISIBLE_CHIPS = 5

const SOURCE_FILTERS: InboxSourceFilter[] = [
  'all',
  'mailbox',
  'group',
  'telegram',
  'funk',
  'lagebild',
]

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function PartnerChipSection(p: {
  title: string
  options: InboxPartnerOption[]
  partnerKey: string | null
  onPartnerKeyChange: (key: string | null) => void
  onPartnerSelectForSend: (address: string) => void
  stripTransport: 'mesh' | 'iota' | 'all'
  onRemoveFromQuickList?: (
    address: string,
    opts: { hideMatchingMessages: boolean; messageTransport: 'mesh' | 'iota' | 'all' }
  ) => void
}) {
  const { title, options, partnerKey, onPartnerKeyChange, onPartnerSelectForSend, stripTransport, onRemoveFromQuickList } =
    p
  const [overflowOpen, setOverflowOpen] = useState(false)
  if (options.length === 0) return null

  const visible = options.slice(0, MAX_VISIBLE_CHIPS)
  const overflow = options.slice(MAX_VISIBLE_CHIPS)

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
      <button
        type="button"
        onClick={() => onPartnerKeyChange(null)}
        className={cn(
          'shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
          partnerKey == null
            ? 'border-primary bg-primary/15 text-primary'
            : 'border-border bg-background text-muted-foreground hover:bg-muted'
        )}
      >
        Alle
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {visible.map((o) => {
          const active = partnerKey != null && norm(partnerKey) === norm(o.address)
          return (
            <span
              key={`${title}-${o.address}`}
              className="inline-flex max-w-[min(100%,11rem)] items-stretch overflow-hidden rounded-md border border-border bg-background"
            >
              <button
                type="button"
                title={o.address}
                onClick={() => {
                  onPartnerSelectForSend(o.address)
                }}
                className={cn(
                  'inline-flex min-w-0 flex-1 items-center gap-1 truncate px-2 py-1 text-left text-xs font-medium transition-colors',
                  active ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted'
                )}
              >
                <span className="truncate">{o.label}</span>
                {!active && (o.unreadCount ?? 0) > 0 ? (
                  <span className="shrink-0 rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
                    {(o.unreadCount ?? 0) > 99 ? '99+' : o.unreadCount}
                  </span>
                ) : null}
              </button>
              {onRemoveFromQuickList ? (
                <button
                  type="button"
                  className="shrink-0 border-l border-border/80 px-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title={`„${o.label}“ aus Schnellliste entfernen`}
                  aria-label={`${title}: ${o.label} aus Schnellliste entfernen`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const ok1 = window.confirm(
                      `„${o.label}“ aus der Partner-Schnellliste entfernen?\n\nNur auf diesem Gerät. Eine Blockliste verhindert, dass der Posteingang die Adresse erneut automatisch vorschlägt.`
                    )
                    if (!ok1) return
                    const ok2 = window.confirm(
                      stripTransport === 'all'
                        ? 'Zusätzlich alle sichtbaren Posteingangs-Zeilen mit diesem Gegenüber lokal ausblenden? (nur diese Session)'
                        : stripTransport === 'mesh'
                          ? 'Zusätzlich alle sichtbaren Zeilen mit diesem Gegenüber ausblenden, die Funk/Mesh nutzen? (nur lokal, diese Session)'
                          : 'Zusätzlich alle sichtbaren Zeilen mit diesem Gegenüber ausblenden, die IOTA/Mailbox nutzen? (nur lokal, diese Session)'
                    )
                    onRemoveFromQuickList(o.address, {
                      hideMatchingMessages: ok2,
                      messageTransport: stripTransport,
                    })
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </span>
          )
        })}
      </div>
      {overflow.length > 0 ? (
        <DropdownMenu open={overflowOpen} onOpenChange={setOverflowOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              +{overflow.length}
              <ChevronDown className="ml-0.5 inline h-3 w-3 opacity-70" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            {overflow.map((o) => (
              <DropdownMenuItem
                key={`${title}-more-${o.address}`}
                className="font-mono text-xs"
                onClick={() => {
                  onPartnerSelectForSend(o.address)
                  setOverflowOpen(false)
                }}
              >
                <span className="truncate">{o.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

export type ChatViewInboxPartnerStripProps = {
  partnerOptions: InboxPartnerOption[]
  myAddressKnown: boolean
  partnerKey: string | null
  onPartnerKeyChange: (key: string | null) => void
  direction: InboxDirectionFilter
  onDirectionChange: (d: InboxDirectionFilter) => void
  sourceFilter: InboxSourceFilter
  onSourceFilterChange: (f: InboxSourceFilter) => void
  showLagebildSource?: boolean
  wireFilter: InboxWireFilter
  onWireFilterChange: (f: InboxWireFilter) => void
  onPartnerSelectForSend: (address: string) => void
  showWireSection?: boolean
  showChannelSection?: boolean
  showPartnerSection?: boolean
  onRemoveInboxPartnerFromQuickList?: (
    address: string,
    opts: { hideMatchingMessages: boolean; messageTransport: 'mesh' | 'iota' | 'all' }
  ) => void
  apiStatus?: ApiStatus | null
}

export function ChatViewInboxPartnerStrip(p: ChatViewInboxPartnerStripProps) {
  const {
    partnerOptions,
    myAddressKnown,
    partnerKey,
    onPartnerKeyChange,
    direction,
    onDirectionChange,
    sourceFilter,
    onSourceFilterChange,
    showLagebildSource = true,
    wireFilter,
    onWireFilterChange,
    onPartnerSelectForSend,
    showWireSection = true,
    showChannelSection = true,
    showPartnerSection = true,
    onRemoveInboxPartnerFromQuickList,
    apiStatus,
  } = p

  const hasAnyPartners = partnerOptions.length > 0
  const sourceOptions = SOURCE_FILTERS.filter((id) => id !== 'lagebild' || showLagebildSource)

  return (
    <div className="space-y-2 border-b border-border/80 bg-muted/20 px-3 py-2">
      {showWireSection ? (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Posteingang (Inhalt)
          </span>
          {(
            [
              ['all', 'Alles'],
              ['encrypted', 'Verschlüsselt'],
              ['plaintext', 'Klartext'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onWireFilterChange(id)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                wireFilter === id
                  ? 'border-emerald-600 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      ) : null}
      {showChannelSection ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {myAddressKnown ? (
              <>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Richtung</span>
                {(
                  [
                    ['all', 'Alle'],
                    ['in', 'Eingang'],
                    ['out', 'Ausgang'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onDirectionChange(id)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      direction === id
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Kanal</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Quelle</span>
            {sourceOptions.map((id) => {
              const sourceOk = inboxSourceFilterReadAllowed(apiStatus, id)
              const deniedTitle = inboxSourceFilterDeniedReason(apiStatus, id)
              return (
              <button
                key={id}
                type="button"
                disabled={!sourceOk}
                title={!sourceOk && deniedTitle ? deniedTitle : undefined}
                onClick={() => onSourceFilterChange(id)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  !sourceOk && 'cursor-not-allowed opacity-40',
                  sourceFilter === id && sourceOk
                    ? id === 'funk'
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                      : id === 'telegram'
                        ? 'border-sky-500/50 bg-sky-500/10 text-sky-950 dark:text-sky-100'
                        : 'border-violet-600 bg-violet-500/15 text-violet-950 dark:text-violet-100'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {inboxSourceFilterLabel(id)}
              </button>
            )})}
          </div>
          {sourceFilter !== 'all' || direction !== 'all' ? (
            <p className="text-xs text-muted-foreground" role="status">
              Kanal-Filter aktiv — zum vollen Posteingang Quelle und Richtung auf „Alle“ setzen oder Kanal-Filter
              ausschalten.
            </p>
          ) : null}
        </div>
      ) : null}
      {showPartnerSection && hasAnyPartners ? (
        <PartnerChipSection
          title="Partner"
          stripTransport="all"
          options={partnerOptions}
          partnerKey={partnerKey}
          onPartnerKeyChange={onPartnerKeyChange}
          onPartnerSelectForSend={onPartnerSelectForSend}
          onRemoveFromQuickList={onRemoveInboxPartnerFromQuickList}
        />
      ) : null}
    </div>
  )
}
