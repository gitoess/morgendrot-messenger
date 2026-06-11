'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, Download, ExternalLink, RefreshCw, Settings2 } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import { postApplyEinsatzConfig, postUpgradeMovePackage } from '@/frontend/lib/api/einsatz-config'
import { formatHandoffAddressShort, formatHandoffMailboxShort } from '@/frontend/lib/handoff-export-display'
import { downloadHandoffZipExport } from '@/frontend/lib/handoff-export-download'
import { buildEinsatzQuickHandoffBody } from '@/frontend/lib/einsatz-handoff-quick-export'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import { cn } from '@/lib/utils'

function StatusPill(p: { ok: boolean; label: string; hint?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        p.ok ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
      )}
      title={p.hint}
    >
      {p.ok ? <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden /> : <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />}
      {p.label}
    </span>
  )
}

function ConfigRow(p: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:items-baseline">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{p.label}</dt>
      <dd className={cn('text-sm text-foreground', p.mono && 'font-mono text-xs break-all')}>{p.value}</dd>
    </div>
  )
}

export function DashboardEinsatzKonfiguration(p: {
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onRefreshStatus?: () => void | Promise<void>
  className?: string
}) {
  const cfg = p.apiStatus?.einsatzConfig
  const packageId = p.apiStatus?.packageId?.trim() || ''
  const primaryMb = p.apiStatus?.mailboxId?.trim() || ''
  const unionMbs = p.apiStatus?.inboxUnionMailboxIds ?? []
  const localTeam = readMyTeamMailboxes()
  const teamLabels = localTeam
    .filter((t) => t.objectId?.trim())
    .map((t) => t.label?.trim() || formatHandoffMailboxShort(t.objectId))
  const extraUnion = unionMbs.filter((id) => id.toLowerCase() !== primaryMb.toLowerCase())
  const move = cfg?.moveFeatures
  const moveProbed = move?.probed === true

  const [ttlDays, setTtlDays] = useState(30)
  const [enablePurge, setEnablePurge] = useState(true)
  const [syncToServer, setSyncToServer] = useState(true)
  const [busy, setBusy] = useState<'upgrade' | 'handoff' | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    const ttl = cfg?.defaultTtlDays
    if (ttl != null && Number.isFinite(ttl)) setTtlDays(Math.floor(ttl))
    if (cfg?.enablePurge != null) setEnablePurge(cfg.enablePurge !== false)
  }, [cfg?.defaultTtlDays, cfg?.enablePurge])

  const onUpgrade = useCallback(async () => {
    if (
      !window.confirm(
        'Move-Package upgraden?\n\n' +
          '• Gleiche PACKAGE_ID und Mailbox-IDs\n' +
          '• Braucht move-test + IOTA-CLI auf diesem PC\n' +
          '• Kein neues Handoff nötig\n' +
          '• Backend danach neu starten\n\n' +
          'Nur wenn der Entwickler Move-Code geändert hat — nicht für TTL/Purge.'
      )
    ) {
      return
    }
    setBusy('upgrade')
    setStatusMsg('')
    const r = await postUpgradeMovePackage()
    setBusy(null)
    if (r.ok) {
      setStatusMsg(r.message || 'Upgrade OK — Backend neu starten, dann Status aktualisieren.')
      await p.onRefreshStatus?.()
    } else {
      setStatusMsg(r.error || 'Upgrade fehlgeschlagen.')
    }
  }, [p.onRefreshStatus])

  const onQuickHandoff = useCallback(async () => {
    setBusy('handoff')
    setStatusMsg('')
    if (syncToServer) {
      const apply = await postApplyEinsatzConfig({
        defaultTtlDays: ttlDays,
        enablePurge,
      })
      if (!apply.ok) {
        setBusy(null)
        setStatusMsg(apply.error || 'Boss-Server-.env nicht aktualisiert.')
        return
      }
    }
    const body = buildEinsatzQuickHandoffBody({
      apiSnapshot: p.apiStatus,
      contactDirectory: p.contactDirectory,
      params: { defaultTtlDays: ttlDays, enablePurge },
      handoffLabel: p.apiStatus?.handoffLabel,
    })
    const dl = await downloadHandoffZipExport(body, {})
    setBusy(null)
    if (dl.ok) {
      setStatusMsg(
        syncToServer
          ? 'Handoff-ZIP gespeichert — Boss-Server-.env übernommen. ZIP an Helfer verteilen.'
          : 'Handoff-ZIP gespeichert — an Helfer verteilen (Boss-.env unverändert).'
      )
      if (syncToServer) await p.onRefreshStatus?.()
    } else {
      setStatusMsg(dl.error || 'Handoff-Download fehlgeschlagen.')
    }
  }, [syncToServer, ttlDays, enablePurge, p.apiStatus, p.contactDirectory, p.onRefreshStatus])

  return (
    <section
      id="einsatz-konfiguration"
      className={cn('scroll-mt-4 rounded-xl border border-sky-500/30 bg-card p-4', p.className)}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Settings2 className="h-4 w-4 text-sky-600" aria-hidden />
            Einsatz-Konfiguration
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <strong className="text-foreground">Parameter</strong> → Handoff ·{' '}
            <strong className="text-foreground">Move-Code</strong> → Upgrade (selten).{' '}
            <Link href="/handbook?file=EINSATZ-BOSS-ABLAUF.md" className="text-primary underline hover:no-underline">
              Boss-Ablauf
            </Link>
          </p>
        </div>
        {p.onRefreshStatus ? (
          <button
            type="button"
            onClick={() => void p.onRefreshStatus?.()}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Status
          </button>
        ) : null}
      </div>

      <dl className="space-y-2.5">
        <ConfigRow
          label="Edition"
          value={
            <span>
              {cfg?.editionLabel ?? 'Standard (Purge + Rebate)'}
              <span className="ml-2 text-xs text-muted-foreground">(Deploy, kein Schalter)</span>
            </span>
          }
        />
        <ConfigRow
          label="Package"
          value={
            packageId ? (
              <span title={packageId}>
                {formatHandoffAddressShort(packageId)}
                {cfg?.deployModeHint ? (
                  <span className="ml-2 text-xs text-muted-foreground"> · {cfg.deployModeHint}</span>
                ) : null}
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">PACKAGE_ID fehlt</span>
            )
          }
          mono
        />
        <ConfigRow
          label="UpgradeCap"
          value={
            cfg?.upgradeCapConfigured ? (
              <span title={cfg.upgradeCapId ?? undefined}>
                {cfg.upgradeCapIdMasked ?? formatHandoffAddressShort(cfg.upgradeCapId ?? '')}
                {cfg.upgradeCapResolvedFromChain ? (
                  <span className="ml-2 text-xs text-muted-foreground">(Wallet)</span>
                ) : null}
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">fehlt — nur Neu-Publish</span>
            )
          }
          mono
        />
        <ConfigRow
          label="Server-MB"
          value={
            primaryMb ? (
              <span title={primaryMb}>{formatHandoffMailboxShort(primaryMb)}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
          mono
        />
        <ConfigRow
          label="Team-Postfächer"
          value={
            teamLabels.length > 0 ? (
              <span>{teamLabels.join(' · ')}</span>
            ) : extraUnion.length > 0 ? (
              <span>{extraUnion.map((id) => formatHandoffMailboxShort(id)).join(' · ')}</span>
            ) : (
              <span className="text-muted-foreground">Keine</span>
            )
          }
        />
      </dl>

      <div className="mt-4 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Einsatz-Parameter (Handoff)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="einsatz-ttl">
              TTL (DEFAULT_TTL_DAYS)
            </label>
            <input
              id="einsatz-ttl"
              type="number"
              min={0}
              max={3650}
              value={ttlDays}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                setTtlDays(Number.isFinite(n) ? Math.max(0, Math.min(3650, n)) : 0)
              }}
              className="w-full rounded-lg border border-border bg-input px-2 py-2 text-sm"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Tage — Nachrichten/Handshake on-chain</p>
          </div>
          <div className="flex flex-col justify-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enablePurge}
                onChange={(e) => setEnablePurge(e.target.checked)}
              />
              Purge erlauben (ENABLE_PURGE)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={syncToServer}
                onChange={(e) => setSyncToServer(e.target.checked)}
              />
              Auch Boss-Server (.env) übernehmen
            </label>
            <p className="text-[10px] text-muted-foreground">
              Purge schützt nur API/UI — Chain-Regeln siehe Handbuch.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void onQuickHandoff()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {busy === 'handoff' ? 'Erzeuge ZIP…' : 'Neues Handoff-ZIP (Helfer)'}
          </button>
          <Link
            href="#einsatz-handoff-export"
            className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/40"
          >
            Feintuning ↓
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border/70 bg-muted/15 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Move-Code (Chain)
        </p>
        {!packageId ? (
          <p className="text-xs text-muted-foreground">PACKAGE_ID setzen.</p>
        ) : !moveProbed ? (
          <p className="text-xs text-muted-foreground">
            {move?.error ? `RPC: ${move.error}` : 'Funktionen werden geprüft…'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <StatusPill ok={!!move?.teamBroadcastStore} label="Team-Broadcast senden" />
            <StatusPill ok={!!move?.teamBroadcastPurge} label="Team-Broadcast purge" />
            <StatusPill ok={!!move?.privateMailboxPurge} label="Private MB purge" />
          </div>
        )}
        {moveProbed && move && !move.teamBroadcastPurge ? (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            Team-Purge fehlt im Package — unten upgraden (wenn UpgradeCap vorhanden).
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy != null || !cfg?.upgradeCapConfigured}
          onClick={() => void onUpgrade()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sky-600/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
          title={cfg?.upgradeCapConfigured ? undefined : 'UpgradeCap fehlt — nur Neu-Publish'}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', busy === 'upgrade' && 'animate-spin')} aria-hidden />
          {busy === 'upgrade' ? 'Upgrade läuft…' : 'Move-Package upgraden'}
        </button>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Dev-PC: move-test + IOTA-CLI. Nicht für TTL/Purge — dafür Handoff oben.
        </p>
      </div>

      {statusMsg ? (
        <p className="mt-3 text-xs text-foreground" role="status">
          {statusMsg}
        </p>
      ) : null}

      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        <Link href="/handbook?file=MOVE-MESSENGER-KONFIGURATION.md" className="text-primary underline hover:no-underline">
          Move-Regeln
        </Link>
        {' · '}
        <Link href="/handbook?file=DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md" className="text-primary underline hover:no-underline">
          Upgrade vs. Publish
        </Link>
        <ExternalLink className="ml-0.5 inline h-3 w-3 opacity-60" aria-hidden />
      </p>
    </section>
  )
}
