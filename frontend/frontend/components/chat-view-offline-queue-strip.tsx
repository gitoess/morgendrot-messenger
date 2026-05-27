'use client'

import { ListOrdered, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isOfflineMailboxQueueEnabled } from '@/frontend/lib/api/offline-queue'

/** Simple Mode: Offline-Warteschlange unter der Chat-Kopfzeile (§ H.0-SIMPLE). */
export function ChatViewOfflineQueueStrip(p: {
  pending: number
  errorHint?: string
  onManualRefresh?: () => void | Promise<void>
  /** Im Simple Mode auch bei pending=0 (Hinweis + Opt-in). */
  alwaysVisible?: boolean
  className?: string
}) {
  const showIdle = p.alwaysVisible && p.pending <= 0
  if (p.pending <= 0 && !showIdle) return null

  const optIn = isOfflineMailboxQueueEnabled()

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 text-sm',
        p.pending > 0
          ? 'border-amber-600/50 bg-amber-500/15 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-50'
          : 'border-border/70 bg-muted/20 text-muted-foreground',
        p.className
      )}
      role="status"
      aria-live="polite"
    >
      <ListOrdered className="h-4 w-4 shrink-0" aria-hidden />
      {p.pending > 0 ? (
        <>
          <span className="font-semibold text-amber-950 dark:text-amber-50">
            {p.pending === 1 ? '1 Nachricht wartet' : `${p.pending} Nachrichten warten`}
          </span>
          <span className="text-xs text-amber-900/90 dark:text-amber-100/90">
            — wird gesendet, sobald die Basis wieder erreichbar ist.
          </span>
        </>
      ) : (
        <span className="text-xs leading-snug">
          <strong className="text-foreground">Offline-Warteschlange</strong>
          {optIn
            ? ' — aktiv. Fehlgeschlagene Online-Sends werden lokal zwischengespeichert und erneut versucht.'
            : ' — optional: in der Browser-Konsole `localStorage.setItem(\'morgendrot.offlineMailboxQueue\',\'1\')`, dann Seite neu laden.'}
        </span>
      )}
      {p.errorHint ? (
        <span className="w-full font-mono text-[10px] leading-snug opacity-90">{p.errorHint}</span>
      ) : null}
      {p.onManualRefresh && p.pending > 0 ? (
        <button
          type="button"
          onClick={() => void p.onManualRefresh?.()}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-700/40 bg-amber-100/80 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-900/50 dark:text-amber-100"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Erneut versuchen
        </button>
      ) : null}
    </div>
  )
}
