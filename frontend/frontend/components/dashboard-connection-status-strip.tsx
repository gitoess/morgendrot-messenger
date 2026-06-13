'use client'

import { cn } from '@/lib/utils'

export function DashboardConnectionStatusStrip(p: {
  backendReachable: boolean | null
  connected: boolean | null
  locked: boolean
}) {
  const basisOnline = p.backendReachable === true && !p.locked
  const basisLabel =
    p.backendReachable === null
      ? 'Verbinde…'
      : p.locked
        ? 'Tresor gesperrt'
        : p.backendReachable
          ? 'Online'
          : 'Offline'

  const chatLabel = p.locked
    ? '—'
    : p.connected
      ? 'Chat verbunden'
      : p.backendReachable
        ? 'Chat bereit'
        : '—'

  return (
    <div
      className="flex flex-col items-end gap-0.5 text-right text-[11px] leading-tight text-muted-foreground"
      aria-live="polite"
    >
      <span
        className={cn('inline-flex items-center gap-1.5', basisOnline && 'text-emerald-700/90 dark:text-emerald-400/95')}
        title="Verbindung zur Morgendrot-Basis (API)"
      >
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            p.backendReachable === null && 'animate-pulse bg-muted-foreground',
            basisOnline && 'bg-emerald-500',
            !basisOnline && p.backendReachable !== null && 'bg-amber-500/80'
          )}
          aria-hidden
        />
        Basis: {basisLabel}
      </span>
      {!p.locked ? (
        <span className="inline-flex items-center gap-1.5" title="Handshake / Connect mit Partner">
          {p.connected ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/80" aria-hidden />
          ) : null}
          {chatLabel}
        </span>
      ) : null}
    </div>
  )
}
