'use client'

/**
 * Hauptmenü: IOTA-Aktivität (Msg-Burn, NFT Ein/Aus/Burn) — lokal auf diesem Gerät.
 */

import { useEffect, useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import {
  IOTA_ACTIVITY_FILTER_OPTIONS,
  IOTA_ACTIVITY_LISTEN_EVENTS,
  iotaActivityKindLabel,
  iotaActivityMatchesFilter,
  listIotaActivity,
  type IotaActivityEntry,
  type IotaActivityFilterId,
} from '@/frontend/lib/iota-activity-local-log'
import {
  explorerObjectUrlFromId,
  explorerTxUrlFromDigest,
} from '@/frontend/lib/iota-tx-explorer-hint'
import { TechnicalIdRow } from '@/frontend/components/technical-id-row'
import { copyTextSafe } from '@/frontend/lib/copy-text-safe'
import { cn } from '@/lib/utils'

function activityCopyBundle(a: IotaActivityEntry): string {
  return [
    `kind=${a.kind}`,
    `summary=${a.summary}`,
    a.digest ? `tx=${a.digest}` : '',
    a.objectId ? `object=${a.objectId}` : '',
    a.counterparty ? `counterparty=${a.counterparty}` : '',
    a.nonce ? `nonce=${a.nonce}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function DashboardIotaActivityCard({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<IotaActivityEntry[]>(() => listIotaActivity(80))
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState<IotaActivityFilterId>('all')

  useEffect(() => {
    const sync = () => setRows(listIotaActivity(80))
    sync()
    for (const ev of IOTA_ACTIVITY_LISTEN_EVENTS) {
      window.addEventListener(ev, sync)
    }
    return () => {
      for (const ev of IOTA_ACTIVITY_LISTEN_EVENTS) {
        window.removeEventListener(ev, sync)
      }
    }
  }, [])

  const filtered = useMemo(
    () => rows.filter((r) => iotaActivityMatchesFilter(r, filter)),
    [rows, filter]
  )
  const filterLabel =
    IOTA_ACTIVITY_FILTER_OPTIONS.find((o) => o.id === filter)?.label || 'Alle'

  return (
    <div
      id="dashboard-iota-activity"
      className={cn(
        'rounded-xl border border-border/80 bg-card/60',
        compact ? 'p-3' : 'rounded-2xl border-border bg-card/90 p-4 shadow-sm'
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity
            className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-foreground/80')}
            aria-hidden
          />
          <h3 className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
            IOTA-Aktivität
          </h3>
        </div>
        <button
          type="button"
          className={cn(
            'rounded-md border px-2 py-1 text-[10px] font-medium',
            filter !== 'all' || filterOpen
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
          )}
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((v) => !v)}
        >
          Filter{filter !== 'all' ? `: ${filterLabel}` : ''}
        </button>
      </div>

      {filterOpen ? (
        <div className="mb-2 flex flex-wrap gap-1 rounded-md border border-border/60 bg-muted/15 p-2">
          {IOTA_ACTIVITY_FILTER_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={cn(
                'rounded border px-1.5 py-0.5 text-[10px]',
                filter === o.id
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-border/60 bg-background/40 text-muted-foreground hover:bg-muted'
              )}
              onClick={() => setFilter(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {rows.length === 0 ? 'Noch keine Einträge.' : `Keine Treffer für „${filterLabel}“.`}
        </p>
      ) : (
        <ul className={cn('space-y-1.5 overflow-y-auto text-[11px]', compact ? 'max-h-40' : 'max-h-56')}>
          {filtered.map((a) => {
            const when = new Date(a.atMs).toLocaleString()
            const open = expandedId === a.id
            const txHref = a.digest ? explorerTxUrlFromDigest(a.digest) : ''
            const objHref = a.objectId ? explorerObjectUrlFromId(a.objectId) : ''
            return (
              <li
                key={a.id}
                className={cn(
                  'rounded-md border bg-background/50 px-2.5 py-1.5 text-muted-foreground',
                  open ? 'border-primary/40' : 'border-border/50'
                )}
              >
                <div
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer items-start justify-between gap-2 break-all rounded-sm text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.995]"
                  title="Klick: IDs · Doppelklick: TX/Objekt im Explorer"
                  aria-expanded={open}
                  aria-label={`${iotaActivityKindLabel(a.kind)}. Tippen für IDs.`}
                  onClick={() => setExpandedId((cur) => (cur === a.id ? null : a.id))}
                  onDoubleClick={() => {
                    const href = txHref || objHref
                    if (href) window.open(href, '_blank', 'noopener,noreferrer')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedId((cur) => (cur === a.id ? null : a.id))
                    }
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground">
                      {iotaActivityKindLabel(a.kind)}
                    </span>
                    <span
                      className="ml-1 text-[9px] text-muted-foreground"
                      title="Tippen auf die Zeile: IDs anzeigen"
                    >
                      · IDs
                    </span>
                    {' · '}
                    {when}
                    {' · '}
                    {a.summary}
                    {a.objectId ? ` · ${a.objectId.slice(0, 12)}…` : ''}
                    {a.counterparty ? ` · ${a.counterparty.slice(0, 10)}…` : ''}
                    {a.nonce ? ` · #${a.nonce}` : ''}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    {txHref ? (
                      <a
                        href={txHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                        title="Transaktion im Explorer (Ablauf)"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        TX
                      </a>
                    ) : null}
                    {objHref ? (
                      <a
                        href={objHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                        title="On-Chain-Objekt (NFT/Purse/…) — Netz muss stimmen"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        Objekt
                      </a>
                    ) : null}
                  </span>
                </div>
                {open ? (
                  <div
                    className="mt-1.5 space-y-1.5 border-t border-border/40 pt-1.5"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    {a.digest ? (
                      <TechnicalIdRow
                        label="TX Digest"
                        value={a.digest}
                        href={explorerTxUrlFromDigest(a.digest)}
                      />
                    ) : null}
                    {a.objectId ? (
                      <TechnicalIdRow
                        label="Object-ID"
                        value={a.objectId}
                        href={explorerObjectUrlFromId(a.objectId)}
                      />
                    ) : null}
                    {a.counterparty ? (
                      <TechnicalIdRow label="Gegenadresse" value={a.counterparty} />
                    ) : null}
                    {a.nonce ? <TechnicalIdRow label="Nonce" value={a.nonce} /> : null}
                    {!a.digest && !a.objectId && !a.counterparty && !a.nonce ? (
                      <p className="text-[10px] text-muted-foreground">
                        Keine technischen IDs gespeichert.
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => {
                          void copyTextSafe(activityCopyBundle(a))
                        }}
                      >
                        Alle IDs kopieren
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
