'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Compass, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ApiStatus } from '@/frontend/lib/api/status'
import {
  buildOnboardingSkipContext,
  getOnboardingWizardStepProgress,
  isOnboardingFinished,
  needsOnboardingResume,
  prepareOnboardingWizardOpen,
  readOnboardingProgress,
  requestOpenOnboardingWizard,
  startOnboarding,
  ONBOARDING_PROGRESS_CHANGED_EVENT,
} from '@/frontend/lib/onboarding-progress-store'
import { isBossReady } from '@/frontend/lib/boss-readiness'

export function OnboardingResumeCard(p: {
  apiSnapshot?: ApiStatus | null
  className?: string
}) {
  const [, bump] = useState(0)
  const ctx = useMemo(() => buildOnboardingSkipContext(p.apiSnapshot), [p.apiSnapshot])

  useEffect(() => {
    const sync = () => bump((n) => n + 1)
    window.addEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, sync)
    return () => window.removeEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, sync)
  }, [])

  const progress = readOnboardingProgress()
  const finished = isOnboardingFinished()
  const showResume = Boolean(progress && needsOnboardingResume(ctx))
  const bossReady =
    progress?.path === 'boss'
      ? isBossReady({ api: p.apiSnapshot, fallbackMyAddress: undefined })
      : true

  if (!progress) return null

  const pathLabel =
    progress.path === 'boss' ? 'Einsatzleitung' : progress.path === 'helper' ? 'Helfer' : 'Privat'

  if (finished) {
    return (
      <div
        className={cn(
          'mb-5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-4',
          p.className
        )}
      >
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Einrichtung abgeschlossen</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {pathLabel}-Wizard — du kannst Schritte erneut ansehen oder von vorn beginnen.
              </p>
              {!bossReady ? (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  Hinweis: Pflicht-Checks (Wallet, Package, Postfach) noch nicht vollständig — Wizard erneut öffnen
                  oder nach dem nächsten „Fertig“ das Readiness-Modal prüfen.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  prepareOnboardingWizardOpen(progress.path)
                  requestOpenOnboardingWizard()
                }}
              >
                <Play className="mr-1.5 h-4 w-4" aria-hidden />
                Wizard öffnen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  startOnboarding(progress.path)
                  requestOpenOnboardingWizard()
                }}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                Erneut starten
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!showResume) return null

  const { stepNumber, stepTotal, percent } = getOnboardingWizardStepProgress(progress)

  return (
    <div
      className={cn(
        'mb-5 rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-4',
        p.className
      )}
    >
      <div className="flex items-start gap-3">
        <Compass className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Einrichtung fortsetzen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pathLabel}-Wizard — Schritt {stepNumber} von {stepTotal} ({percent}%). Schritte sind überspringbar.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => requestOpenOnboardingWizard()}>
            <Play className="mr-1.5 h-4 w-4" aria-hidden />
            Wizard fortsetzen
          </Button>
        </div>
      </div>
    </div>
  )
}
