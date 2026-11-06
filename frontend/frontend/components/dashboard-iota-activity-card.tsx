'use client'

/**
 * Hauptmenü: IOTA-Aktivität (Msg-Burn, NFT Ein/Aus/Burn) — lokal auf diesem Gerät.
 */

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import {
  IOTA_ACTIVITY_LISTEN_EVENTS,
  iotaActivityKindLabel,
  listIotaActivity,
  type IotaActivityEntry,
} from '@/frontend/lib/iota-activity-local-log'
import { explorerTxUrlFromDigest } from '@/frontend/lib/iota-tx-explorer-hint'
import { cn } from '@/lib/utils'

export function DashboardIotaActivityCard({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<IotaActivityEntry[]>(() => listIotaActivity(40))

  useEffect(() => {
    const sync = () => setRows(listIotaActivity(40))
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

  return (
    <div
      id="dashboard-iota-activity"
      className={cn(
        'rounded-xl border border-border/80 bg-card/60',
        compact ? 'p-3' : 'rounded-2xl border-border bg-card/90 p-4 shadow-sm'
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Activity className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-foreground/80')} aria-hidden />
        <h3 className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
          IOTA-Aktivität
        </h3>
      </div>
      <p className="mb-2 text-[10px] text-muted-foreground">
        Chain-Ereignisse dieses Geräts: Burn, NFT Ein/Aus. Coin folgt. Explorer behält die TXs.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Einträge.</p>
      ) : (
        <ul className={cn('space-y-1.5 overflow-y-auto text-[11px]', compact ? 'max-h-40' : 'max-h-56')}>
          {rows.map((a) => {
            const when = new Date(a.atMs).toLocaleString()
            return (
              <li
                key={a.id}
                className="rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5 break-all text-muted-foreground"
              >
                <span className="font-semibold text-foreground">{iotaActivityKindLabel(a.kind)}</span>
                {' · '}
                {when}
                {' · '}
                {a.summary}
                {a.objectId ? ` · ${a.objectId.slice(0, 12)}…` : ''}
                {a.counterparty ? ` · ${a.counterparty.slice(0, 10)}…` : ''}
                {a.nonce ? ` · #${a.nonce}` : ''}
                {a.digest ? (
                  <>
                    {' · '}
                    <a
                      href={explorerTxUrlFromDigest(a.digest)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      TX
                    </a>
                  </>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
