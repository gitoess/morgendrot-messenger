'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, DatabaseZap, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OfflineStatusSnapshot } from '@/frontend/hooks/use-offline-status'
import { fetchStatus } from '@/frontend/lib/api/status'
import { getApiBase } from '@/frontend/lib/api/api-base'
import { getNativeLoopbackApiBaseWarning } from '@/frontend/lib/api-base-native-hints'
import { formatRelativeMinutes } from '@/frontend/lib/format-relative-sync'
import {
  getDirectIotaHeaderStatusLine,
  getDirectIotaSetupGapLabels,
} from '@/frontend/lib/autarky-status-line'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'

function modeLabel(mode: OfflineStatusSnapshot['mode']): string {
  if (mode === 'online') return 'Online'
  if (mode === 'cache') return 'Cache-Modus'
  return 'Offline'
}

function compactHeadline(mode: OfflineStatusSnapshot['mode']): string {
  if (mode === 'online') return 'Verbindung zur Basis: Online'
  if (mode === 'cache') return 'Verbindung zur Basis: Cache (eingeschränkt)'
  return 'Verbindung zur Basis: Offline'
}

export function OfflineStatusCard(p: {
  status: OfflineStatusSnapshot
  variant?: 'compact' | 'full'
  className?: string
  onTestConnection?: () => void | Promise<void>
  onResync?: () => void | Promise<void>
  onEnableQueueOptIn?: () => void
  onOpenHandoffImport?: () => void
}) {
  const variant = p.variant ?? 'full'
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [probeLine, setProbeLine] = useState<string | null>(null)
  const [autarkyLine, setAutarkyLine] = useState<string | null>(null)
  const [directGaps, setDirectGaps] = useState<string[]>([])

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const refresh = () => {
      setAutarkyLine(getDirectIotaHeaderStatusLine())
      setDirectGaps(getDirectIotaSetupGapLabels())
    }
    refresh()
    window.addEventListener(DIRECT_IOTA_UI_CHANGED, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(DIRECT_IOTA_UI_CHANGED, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [hydrated, p.status.mode])

  useEffect(() => {
    const onBase = () => setProbeLine(null)
    window.addEventListener('morgendrot.apiBaseChanged', onBase)
    return () => window.removeEventListener('morgendrot.apiBaseChanged', onBase)
  }, [])

  const loopbackWarn = hydrated ? getNativeLoopbackApiBaseWarning() : null

  const runReconnect = async () => {
    setBusy(true)
    setProbeLine(null)
    const warn = getNativeLoopbackApiBaseWarning()
    if (warn) {
      setProbeLine(warn)
      setBusy(false)
      return
    }
    const base = getApiBase()
    if (!base) {
      setProbeLine('Keine Basis-URL — bitte in den Einstellungen die Adresse des Servers eintragen.')
      setBusy(false)
      return
    }
    try {
      const res = await fetchStatus()
      if ('pollClockHint' in res && res.backendRunning !== false) {
        setProbeLine('Verbindung wiederhergestellt.')
        await p.onResync?.()
        await p.onTestConnection?.()
      } else {
        const err =
          ('error' in res && typeof res.error === 'string' && res.error) ||
          'Basis nicht erreichbar — Netzwerk oder Server prüfen.'
        setProbeLine(err)
      }
    } catch (e) {
      setProbeLine(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const icon =
    p.status.mode === 'online' ? (
      <Wifi className="h-4 w-4 text-emerald-500" aria-hidden />
    ) : p.status.mode === 'cache' ? (
      <DatabaseZap className="h-4 w-4 text-amber-500" aria-hidden />
    ) : (
      <WifiOff className="h-4 w-4 text-red-500" aria-hidden />
    )

  const shellClass = cn(
    'relative z-10 mb-5 rounded-xl border px-4 py-3',
    p.className,
    p.status.mode === 'online'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : p.status.mode === 'cache'
        ? 'border-amber-500/35 bg-amber-500/10'
        : 'border-red-500/30 bg-red-500/10'
  )

  if (variant === 'compact') {
    const showReconnect = p.status.mode !== 'online'
    return (
      <div className={shellClass} role="status" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon}
            <p className="text-sm font-semibold text-foreground">{compactHeadline(p.status.mode)}</p>
          </div>
          {showReconnect ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runReconnect()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Verbindung wiederherstellen
            </button>
          ) : null}
        </div>
        {loopbackWarn ? (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{loopbackWarn}</p>
        ) : null}
        {probeLine ? (
          <p
            className={cn(
              'mt-2 text-xs',
              probeLine.includes('wiederhergestellt') ? 'text-emerald-700 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'
            )}
          >
            {probeLine}
          </p>
        ) : null}
        {autarkyLine ? (
          <p
            className={cn(
              'mt-2 text-xs',
              autarkyLine.includes('vollständig')
                ? 'text-emerald-800 dark:text-emerald-200'
                : 'text-amber-900 dark:text-amber-100'
            )}
          >
            {autarkyLine}
          </p>
        ) : null}
        {directGaps.length > 1 ? (
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] text-amber-900/90 dark:text-amber-100/90">
            {directGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1.5 text-xs text-muted-foreground">
          Letzte Synchronisation:{' '}
          {!hydrated ? '…' : formatRelativeMinutes(p.status.lastSuccessfulSyncMinutes)}
          {hydrated && p.status.queuePending > 0
            ? ` · ${p.status.queuePending} Nachricht(en) in der Warteschlange`
            : ''}
        </p>
        {p.status.localHandoffOnly && p.onOpenHandoffImport ? (
          <button
            type="button"
            onClick={() => p.onOpenHandoffImport?.()}
            className="mt-2 text-xs font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-200"
          >
            Handoff-Import öffnen
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={shellClass} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold text-foreground">Offline-Status: {modeLabel(p.status.mode)}</p>
        </div>
        {p.status.mode !== 'online' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void runReconnect()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Verbindung wiederherstellen
          </button>
        ) : null}
      </div>
      {loopbackWarn ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-50">
          {loopbackWarn}
        </p>
      ) : null}
      {probeLine ? (
        <p
          className={cn(
            'mt-2 rounded-md px-2 py-1.5 text-xs',
            probeLine.includes('wiederhergestellt')
              ? 'border border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
              : 'border border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-100'
          )}
        >
          {probeLine}
        </p>
      ) : null}
      {autarkyLine ? (
        <p
          className={cn(
            'mt-2 rounded-md border px-2 py-1.5 text-xs',
            autarkyLine.includes('vollständig')
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
              : 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-50'
          )}
        >
          {autarkyLine}
        </p>
      ) : null}
      {directGaps.length > 1 ? (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-amber-950/90 dark:text-amber-50/90">
          {directGaps.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        Letzte Synchronisation: {!hydrated ? '…' : formatRelativeMinutes(p.status.lastSuccessfulSyncMinutes)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Queue: {p.status.queuePending} wartend
        {hydrated && !p.status.queueEnabled ? ' (Opt-in aus)' : ''}.
      </p>
      {hydrated && !p.status.queueEnabled ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-muted-foreground">
            Outbox-Opt-in: fehlgeschlagene Sends lokal puffern.
          </p>
          {p.onEnableQueueOptIn ? (
            <button
              type="button"
              onClick={() => p.onEnableQueueOptIn?.()}
              className="min-h-9 touch-manipulation rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
            >
              Queue aktivieren
            </button>
          ) : null}
        </div>
      ) : null}
      {p.status.localHandoffOnly ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-amber-900/90 dark:text-amber-100/90">
            Handoff nur lokal — bei erreichbarer Basis „Import bestätigen“.
          </p>
          {p.onOpenHandoffImport ? (
            <button
              type="button"
              onClick={() => p.onOpenHandoffImport?.()}
              className="min-h-9 touch-manipulation rounded-md border border-amber-500/40 px-2.5 py-1 text-xs hover:bg-amber-500/10"
            >
              Handoff-Import
            </button>
          ) : null}
        </div>
      ) : null}
      {p.status.restrictedFeatures.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Eingeschränkt: {p.status.restrictedFeatures.join(', ')}.
        </p>
      ) : null}
    </div>
  )
}
