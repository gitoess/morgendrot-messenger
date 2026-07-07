'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Circle, Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { scheduleReleaseStuckModalPointerEvents } from '@/frontend/lib/release-modal-pointer-events'
import {
  evaluateBossReadiness,
  type BossReadinessItem,
  type BossReadinessItemStatus,
} from '@/frontend/lib/boss-readiness'
import {
  prepareOnboardingWizardOpen,
  requestOpenOnboardingWizard,
} from '@/frontend/lib/onboarding-progress-store'
import { cn } from '@/lib/utils'

function StatusIcon(p: { status: BossReadinessItemStatus }) {
  if (p.status === 'ok') return <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
  if (p.status === 'warn') return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
  return <Circle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
}

function ReadinessRow(p: { item: BossReadinessItem }) {
  return (
    <li
      className={cn(
        'rounded-md border px-3 py-2',
        p.item.status === 'ok' && 'border-emerald-500/30 bg-emerald-500/5',
        p.item.status === 'warn' && 'border-amber-500/35 bg-amber-500/5',
        p.item.status === 'fail' && 'border-destructive/35 bg-destructive/5'
      )}
    >
      <div className="flex items-start gap-2">
        <StatusIcon status={p.item.status} />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">{p.item.label}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{p.item.detail}</p>
        </div>
      </div>
    </li>
  )
}

export function OnboardingBossReadinessDialog(p: {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiSnapshot?: ApiStatus | null
  sessionLocked?: boolean
  fallbackMyAddress?: string | null
  onReloadStatus?: () => void
}) {
  const [reloading, setReloading] = useState(false)

  const report = useMemo(
    () =>
      evaluateBossReadiness({
        api: p.apiSnapshot,
        sessionLocked: p.sessionLocked,
        fallbackMyAddress: p.fallbackMyAddress,
      }),
    [p.apiSnapshot, p.fallbackMyAddress, p.sessionLocked]
  )

  const primaryItems = report.items.filter((i) => i.id !== 'core')
  const core = report.items.find((i) => i.id === 'core')

  const runReload = async () => {
    setReloading(true)
    try {
      p.onReloadStatus?.()
      await new Promise((r) => setTimeout(r, 400))
    } finally {
      setReloading(false)
    }
  }

  return (
    <Dialog
      open={p.open}
      onOpenChange={(open) => {
        if (!open) scheduleReleaseStuckModalPointerEvents()
        p.onOpenChange(open)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Einrichtung prüfen</DialogTitle>
          <DialogDescription>
            Live-Check aus Boss-Status — unabhängig vom Wizard-Klick „Fertig“. Modus A (leere .env) bleibt der
            Feldtest-Goldstandard.
          </DialogDescription>
        </DialogHeader>

        {core ? (
          <div
            className={cn(
              'rounded-md border px-3 py-2 text-sm',
              core.status === 'ok' && 'border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
              core.status === 'warn' && 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100',
              core.status === 'fail' && 'border-destructive/35 bg-destructive/10 text-destructive'
            )}
          >
            <strong className="font-medium">{core.label}:</strong> {core.detail}
          </div>
        ) : null}

        <ul className="space-y-2">
          {primaryItems.map((item) => (
            <ReadinessRow key={item.id} item={item} />
          ))}
        </ul>

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={reloading} onClick={() => void runReload()}>
              {reloading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Neu laden
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                p.onOpenChange(false)
                prepareOnboardingWizardOpen('boss')
                requestOpenOnboardingWizard()
              }}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Wizard öffnen
            </Button>
          </div>
          <Button type="button" size="sm" onClick={() => p.onOpenChange(false)}>
            {report.ready ? 'Zum Messenger' : 'Trotzdem schließen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
