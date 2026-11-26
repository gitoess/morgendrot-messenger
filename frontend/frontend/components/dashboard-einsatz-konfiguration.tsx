'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Download, RefreshCw, SlidersHorizontal } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import { postApplyEinsatzConfig, postUpgradeMovePackage } from '@/frontend/lib/api/einsatz-config'
import { formatHandoffAddressShort } from '@/frontend/lib/handoff-export-display'
import { downloadHandoffZipExport } from '@/frontend/lib/handoff-export-download'
import { buildEinsatzQuickHandoffBody } from '@/frontend/lib/einsatz-handoff-quick-export'
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

type EinsatzPanelProps = {
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onRefreshStatus?: () => void | Promise<void>
  className?: string
  /** In Helfer-einrichten-Karte — ohne eigene Box */
  inline?: boolean
}

export function DashboardEinsatzParameterPanel(p: EinsatzPanelProps) {
  const cfg = p.apiStatus?.einsatzConfig

  const [ttlDays, setTtlDays] = useState(30)
  const [enablePurge, setEnablePurge] = useState(true)
  const [syncToServer, setSyncToServer] = useState(true)
  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    const ttl = cfg?.defaultTtlDays
    if (ttl != null && Number.isFinite(ttl)) setTtlDays(Math.floor(ttl))
    if (cfg?.enablePurge != null) setEnablePurge(cfg.enablePurge !== false)
  }, [cfg?.defaultTtlDays, cfg?.enablePurge])

  const onQuickHandoff = useCallback(async () => {
    setBusy(true)
    setStatusMsg('')
    let envSynced = false
    let envWarn = ''
    if (syncToServer) {
      const apply = await postApplyEinsatzConfig({
        defaultTtlDays: ttlDays,
        enablePurge,
      })
      if (apply.ok) {
        envSynced = true
      } else {
        envWarn = apply.error || 'Boss-Server-.env nicht aktualisiert.'
      }
    }
    const body = buildEinsatzQuickHandoffBody({
      apiSnapshot: p.apiStatus,
      contactDirectory: p.contactDirectory,
      params: { defaultTtlDays: ttlDays, enablePurge },
      handoffLabel: p.apiStatus?.handoffLabel,
    })
    const dl = await downloadHandoffZipExport(body, {})
    setBusy(false)
    if (dl.ok) {
      if (envWarn) {
        setStatusMsg(`ZIP gespeichert. Boss-.env: ${envWarn} (TTL/Purge stehen im ZIP.)`)
      } else if (envSynced) {
        setStatusMsg('ZIP gespeichert — Boss-.env übernommen.')
      } else {
        setStatusMsg('ZIP gespeichert.')
      }
      if (envSynced) await p.onRefreshStatus?.()
    } else {
      setStatusMsg(dl.error || envWarn || 'Handoff-Download fehlgeschlagen.')
    }
  }, [syncToServer, ttlDays, enablePurge, p.apiStatus, p.contactDirectory, p.onRefreshStatus])

  return (
    <div
      id="einsatz-konfiguration"
      className={cn(
        p.inline ? 'border-t border-border/60 pt-3' : 'scroll-mt-4 rounded-xl border border-violet-500/30 bg-card p-4',
        p.className
      )}
    >
      {!p.inline ? (
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-violet-600" aria-hidden />
          Bestehende Geräte
        </p>
      ) : (
        <p className="mb-2 text-xs font-medium text-muted-foreground">Bestehende Geräte</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-20">
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="einsatz-ttl">
            TTL
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
            className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-sm"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-sm">
          <input type="checkbox" checked={enablePurge} onChange={(e) => setEnablePurge(e.target.checked)} />
          Purge
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-sm" title="Schreibt TTL/Purge zusätzlich in die Boss-PC-.env — unabhängig vom Handoff-ZIP">
          <input type="checkbox" checked={syncToServer} onChange={(e) => setSyncToServer(e.target.checked)} />
          Boss-.env mit TTL/Purge sync
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onQuickHandoff()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {busy ? '…' : 'Handoff'}
        </button>
      </div>

      {statusMsg ? (
        <p className="mt-2 text-xs text-foreground" role="status">
          {statusMsg}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Handoff-ZIP enthält TTL/Purge immer — „Boss-.env sync“ aktualisiert nur den Boss-PC für Server-Defaults.
        </p>
      )}
    </div>
  )
}

/**
 * Move-Funktions-Probe + In-Place-Upgrade — Einstellungen → IOTA → Expertenmodus (T23).
 * Package / Postfach / Upgrade-Cap stehen schon unter Netz / Chain-IDs — hier nicht nochmal.
 */
export function DashboardEinsatzChainPanel(
  p: Pick<EinsatzPanelProps, 'apiStatus' | 'onRefreshStatus' | 'className'> & {
    /** Expertenmodus: nur Probe-Pills + Upgrade-Button, kein Essay. */
    compact?: boolean
  }
) {
  const cfg = p.apiStatus?.einsatzConfig
  const packageId = p.apiStatus?.packageId?.trim() || ''
  const move = cfg?.moveFeatures
  const moveProbed = move?.probed === true
  const missing: string[] = []
  if (moveProbed && move) {
    if (!move.teamBroadcastStore) missing.push('Team-Broadcast speichern')
    if (!move.teamBroadcastPurge) missing.push('Team-Broadcast löschen (Purge)')
    if (!move.privateMailboxPurge) missing.push('Private Mailbox löschen')
  }
  const needsMoveUpgrade = missing.length > 0
  const hasUpgradeCap = !!cfg?.upgradeCapConfigured
  const canUpgrade = hasUpgradeCap && (needsMoveUpgrade || !moveProbed)
  const upgradeBlockReason = !hasUpgradeCap
    ? 'Ausgegraut: kein UpgradeCap in der Boss-.env — dieses Package kann nur neu veröffentlicht werden (neue PACKAGE_ID), nicht in-place upgegradet.'
    : moveProbed && !needsMoveUpgrade
      ? 'Ausgegraut: die geprüften Move-Funktionen sind schon im Package. Knopf nur bei fehlenden Funktionen (gelb). Neuer Move-Code ohne diese Flags: Terminal npm run upgrade:move-package.'
      : !packageId
        ? 'Zuerst PACKAGE_ID setzen (Netz / Chain-IDs oben).'
        : null

  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const onUpgrade = useCallback(async () => {
    const ok = window.confirm(
      'Move-Package in-place upgraden?\n\n' +
        '• Schreibt neuen Move-Code auf dieselbe PACKAGE_ID (braucht UpgradeCap).\n' +
        '• Läuft auf dem Boss-PC gegen den lokalen Move-Ordner (move-test).\n' +
        '• Danach Backend neu starten und hier „Aktualisieren“.\n\n' +
        'Kein Untermenü — direkte Bestätigung. Fortfahren?'
    )
    if (!ok) return
    setBusy(true)
    setStatusMsg('')
    const r = await postUpgradeMovePackage()
    setBusy(false)
    if (r.ok) {
      setStatusMsg(r.message || 'Upgrade OK — Backend neu starten, dann Status aktualisieren.')
      await p.onRefreshStatus?.()
    } else {
      setStatusMsg(r.error || 'Upgrade fehlgeschlagen.')
    }
  }, [p.onRefreshStatus])

  return (
    <section id="einsatz-chain-status" className={cn('scroll-mt-4 space-y-3', p.className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {p.compact ? 'Package & Move-Upgrade' : 'Move-Funktionen (Package-Probe)'}
        </p>
        {p.onRefreshStatus ? (
          <button
            type="button"
            onClick={() => void p.onRefreshStatus?.()}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted/50"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Aktualisieren
          </button>
        ) : null}
      </div>

      {p.compact ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Grün = Move-Funktion im Package. Upgrade nur Boss, braucht UpgradeCap (Chain-IDs oben). Details: Handbuch.
          Cap:{' '}
          {hasUpgradeCap ? (
            <span className="font-mono text-foreground">
              ok
              {cfg?.upgradeCapIdMasked || cfg?.upgradeCapId
                ? ` · ${cfg.upgradeCapIdMasked ?? formatHandoffAddressShort(cfg.upgradeCapId ?? '')}`
                : ''}
            </span>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">fehlt</span>
          )}
        </p>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Welche Messenger-Funktionen das aktuelle Move-Package anbietet — und ob ein In-Place-Upgrade nötig ist.
          Package/Cap: Chain-IDs oben.
        </p>
      )}

      <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
        <p className="mb-2 text-[11px] font-medium text-foreground">Was das Package kann (grün = vorhanden)</p>
        {!packageId ? (
          <p className="text-xs text-muted-foreground">PACKAGE_ID fehlt — Probe unmöglich.</p>
        ) : !moveProbed ? (
          <p className="text-xs text-muted-foreground">
            {move?.error
              ? move.error.includes('.map is not a function')
                ? 'RPC-Probe fehlgeschlagen — Backend neu starten oder „Aktualisieren“.'
                : `RPC: ${move.error}`
              : 'Move-Funktionen werden geprüft…'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <StatusPill
              ok={!!move?.teamBroadcastStore}
              label="Team-Broadcast speichern"
              hint="store_team_plaintext_broadcast — Gruppen-Klartext in Team-Mailbox"
            />
            <StatusPill
              ok={!!move?.teamBroadcastPurge}
              label="Team-Broadcast löschen"
              hint="purge_team_plaintext_broadcast — einzelne Team-Nachrichten on-chain entfernen"
            />
            <StatusPill
              ok={!!move?.privateMailboxPurge}
              label="Private löschen"
              hint="purge_private_mailbox — ganze private Mailbox on-chain aufräumen"
            />
          </div>
        )}
        {needsMoveUpgrade ? (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            Fehlt on-chain: {missing.join(' · ')}. Nach neuem Move-Build hier upgraden, dann Backend neu starten.
          </p>
        ) : null}

        {upgradeBlockReason ? (
          <p className="mt-2 text-xs text-muted-foreground">{upgradeBlockReason}</p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Upgrade = neuer Move-Code auf dieselbe Package-ID (Boss-PC). Danach Backend neu starten.
          </p>
        )}
        <button
          type="button"
          disabled={busy || !canUpgrade}
          onClick={() => void onUpgrade()}
          title={upgradeBlockReason ?? 'In-Place Move-Upgrade starten'}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sky-600/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} aria-hidden />
          {busy ? 'Upgrade läuft…' : 'Move upgraden'}
        </button>
      </div>

      {statusMsg ? (
        <p className="text-xs text-foreground" role="status">
          {statusMsg}
        </p>
      ) : null}
    </section>
  )
}
