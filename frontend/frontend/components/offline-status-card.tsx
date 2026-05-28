'use client'

import { Wifi, WifiOff, DatabaseZap, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OfflineStatusSnapshot } from '@/frontend/hooks/use-offline-status'

function modeLabel(mode: OfflineStatusSnapshot['mode']): string {
  if (mode === 'online') return 'Online'
  if (mode === 'cache') return 'Cache-Modus'
  return 'Offline'
}

export function OfflineStatusCard(p: {
  status: OfflineStatusSnapshot
  onTestConnection?: () => void | Promise<void>
  onResync?: () => void | Promise<void>
}) {
  const icon =
    p.status.mode === 'online' ? (
      <Wifi className="h-4 w-4 text-emerald-500" aria-hidden />
    ) : p.status.mode === 'cache' ? (
      <DatabaseZap className="h-4 w-4 text-amber-500" aria-hidden />
    ) : (
      <WifiOff className="h-4 w-4 text-red-500" aria-hidden />
    )

  return (
    <div
      className={cn(
        'mb-5 rounded-xl border px-4 py-3',
        p.status.mode === 'online'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : p.status.mode === 'cache'
            ? 'border-amber-500/35 bg-amber-500/10'
            : 'border-red-500/30 bg-red-500/10'
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold text-foreground">Offline-Status: {modeLabel(p.status.mode)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void p.onTestConnection?.()}
            className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
          >
            Verbindung testen
          </button>
          <button
            type="button"
            onClick={() => void p.onResync?.()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Neu synchronisieren
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Letzte erfolgreiche Synchronisation:{' '}
        {p.status.lastSuccessfulSyncMinutes == null ? 'keine bekannt' : `vor ${Math.max(0, p.status.lastSuccessfulSyncMinutes)} Min.`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Queue: {p.status.queuePending} wartend
        {p.status.queueEnabled ? '' : ' (Opt-in aus)'}.
      </p>
      {p.status.restrictedFeatures.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Eingeschränkt: {p.status.restrictedFeatures.join(', ')}.
        </p>
      ) : null}
    </div>
  )
}
