'use client'

/**
 * Schnellfilter: Gesprächspartner (Chips) + Richtung Eingang/Ausgang.
 * Klick auf einen Partner setzt Filter und Empfängerfeld für den nächsten Versand.
 */

import { cn } from '@/lib/utils'
import type { InboxDirectionFilter } from '@/frontend/features/inbox/inbox-partner-filter'

export type InboxPartnerOption = { address: string; label: string }

export type ChatViewInboxPartnerStripProps = {
  options: InboxPartnerOption[]
  /** Ohne eigene Adresse sind Eingang/Ausgang-Filter nicht sinnvoll – Zeile ausblenden. */
  myAddressKnown: boolean
  partnerKey: string | null
  onPartnerKeyChange: (key: string | null) => void
  direction: InboxDirectionFilter
  onDirectionChange: (d: InboxDirectionFilter) => void
  /** Partner ausgewählt: Filter + Empfänger für Senden */
  onPartnerSelectForSend: (address: string) => void
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export function ChatViewInboxPartnerStrip(p: ChatViewInboxPartnerStripProps) {
  const {
    options,
    myAddressKnown,
    partnerKey,
    onPartnerKeyChange,
    direction,
    onDirectionChange,
    onPartnerSelectForSend,
  } = p

  if (!myAddressKnown && options.length === 0) return null

  return (
    <div className="border-b border-border/80 bg-muted/20 px-3 py-2">
      {myAddressKnown ? (
      <div className="mb-2 flex flex-wrap items-center gap-2">
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
      </div>
      ) : null}
      {options.length > 0 ? (
      <div className={cn('flex flex-wrap items-center gap-2', myAddressKnown ? '' : '')}>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Gespräch</span>
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
          {options.map((o) => {
            const active = partnerKey != null && norm(partnerKey) === norm(o.address)
            return (
              <button
                key={o.address}
                type="button"
                title={o.address}
                onClick={() => {
                  onPartnerSelectForSend(o.address)
                }}
                className={cn(
                  'max-w-[140px] truncate rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                )}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>
      ) : null}
    </div>
  )
}
