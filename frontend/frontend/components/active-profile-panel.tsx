'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, History, RefreshCw, Shield } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { applyHandoffEnvImport, previewHandoffEnvImport } from '@/frontend/lib/api/handoff-env-import'
import { buildActiveProfileView } from '@/frontend/lib/active-profile-display'
import { resolveDeploymentProfileTheme } from '@/frontend/lib/deployment-profile-theme'
import {
  findActiveHistoryEntry,
  readHandoffProfileHistory,
  recordHandoffProfileImport,
  type HandoffProfileHistoryEntry,
} from '@/frontend/lib/handoff-profile-history'
import { ActiveProfileBadge } from '@/frontend/components/active-profile-badge'
import { cn } from '@/lib/utils'

type ActiveProfilePanelProps = {
  status: ApiStatus | null | undefined
  onOpenHandoffImport?: () => void
}

function formatImportedAt(ms?: number): string {
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

export function ActiveProfilePanel({ status, onOpenHandoffImport }: ActiveProfilePanelProps) {
  const [history, setHistory] = useState<HandoffProfileHistoryEntry[]>([])
  const [switchBusy, setSwitchBusy] = useState<string | null>(null)
  const [switchErr, setSwitchErr] = useState('')

  const refreshHistory = useCallback(() => {
    setHistory(readHandoffProfileHistory())
  }, [])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory, status?.packageId, status?.handoffLabel, status?.role])

  const view = useMemo(() => buildActiveProfileView(status), [status])
  const theme = useMemo(() => resolveDeploymentProfileTheme(status), [status])
  const activeEntry = useMemo(() => findActiveHistoryEntry(status), [status])
  const importedAt = activeEntry?.importedAt

  const onSwitchProfile = async (entry: HandoffProfileHistoryEntry) => {
    if (entry.id === activeEntry?.id) return
    setSwitchBusy(entry.id)
    setSwitchErr('')
    try {
      const preview = await previewHandoffEnvImport(entry.envText)
      if (!preview.ok) {
        setSwitchErr(preview.errors?.join(' ') || preview.error || 'Vorschau fehlgeschlagen')
        return
      }
      const applied = await applyHandoffEnvImport(entry.envText)
      if (!applied.ok) {
        setSwitchErr(applied.errors?.join(' ') || applied.error || 'Wechsel fehlgeschlagen')
        return
      }
      recordHandoffProfileImport(entry.envText, preview.summary ?? null)
      window.location.reload()
    } finally {
      setSwitchBusy(null)
    }
  }

  const previousProfiles = history.filter((e) => e.id !== activeEntry?.id)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
            theme.badgeClass
          )}
        >
          <Shield className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h4 className="font-semibold text-foreground">Aktives Profil</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Orientierung im Einsatz — Bezeichnung und Rolle aus dem Handoff bzw. der{' '}
              <span className="font-mono text-xs">.env</span>.
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <ActiveProfileBadge status={status} />
              <span className="text-xs text-muted-foreground">Theme: {theme.label}</span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>
                <span className="text-foreground">{view.titleLine}</span>
              </li>
              {view.subtitleLine ? <li>Transport: {view.subtitleLine}</li> : null}
              {status?.deploymentProfile ? (
                <li>Deployment: {status.deploymentProfile}</li>
              ) : null}
              <li>Import: {formatImportedAt(importedAt)}</li>
            </ul>
          </div>

          {previousProfiles.length > 0 ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <History className="h-3.5 w-3.5" aria-hidden />
                Vorherige Profile ({previousProfiles.length})
              </p>
              <ul className="space-y-2">
                {previousProfiles.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {entry.handoffLabel || entry.role || 'Handoff'}
                        {entry.role ? ` · ${entry.role}` : ''}
                      </p>
                      <p className="text-muted-foreground">{formatImportedAt(entry.importedAt)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={switchBusy != null}
                      onClick={() => void onSwitchProfile(entry)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                    >
                      {switchBusy === entry.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                      ) : (
                        <ChevronRight className="h-3 w-3" aria-hidden />
                      )}
                      Aktivieren
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-muted-foreground">
                Wechsel merged öffentliche Keys und lädt die Seite neu — kein Seed-Wechsel. Vault bleibt auf dem Gerät.
              </p>
            </div>
          ) : null}

          {switchErr ? <p className="text-xs text-destructive">{switchErr}</p> : null}

          {onOpenHandoffImport ? (
            <button
              type="button"
              onClick={onOpenHandoffImport}
              className="text-sm font-medium text-primary hover:underline"
            >
              Neues Profil importieren (Handoff-ZIP)
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
