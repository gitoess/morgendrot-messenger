'use client'

import { useEffect, useState } from 'react'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { SettingsHandbookLink } from '@/frontend/components/settings-handbook-link'
import {
  buildOnboardingSkipContext,
  needsOnboardingResume,
  ONBOARDING_PROGRESS_CHANGED_EVENT,
  readOnboardingProgress,
  requestOpenOnboardingWizard,
  resolveOnboardingDialogPath,
  startOnboarding,
} from '@/frontend/lib/onboarding-progress-store'
import { readStandaloneOnboardingPath } from '@/frontend/lib/standalone-onboarding'

export function SettingsOnboardingSection(p: { apiStatus?: ApiStatus | null }) {
  const [, bump] = useState(0)
  const dialogPath = resolveOnboardingDialogPath({
    role: p.apiStatus?.role,
    standalonePath: readStandaloneOnboardingPath(),
  })
  const wizardPath = dialogPath
  const ctx = buildOnboardingSkipContext(p.apiStatus)

  useEffect(() => {
    const sync = () => bump((n) => n + 1)
    window.addEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, sync)
    return () => window.removeEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, sync)
  }, [])

  const progress = readOnboardingProgress()
  const showResume = needsOnboardingResume(ctx) && wizardPath !== null

  const openWizard = () => {
    if (!wizardPath) return
    if (!readOnboardingProgress() || readOnboardingProgress()?.path !== wizardPath) {
      startOnboarding(wizardPath)
    }
    requestOpenOnboardingWizard()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
            <Compass className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Einstiegs-Wizard</h4>
            {showResume && progress ? (
              <p className="text-xs text-muted-foreground">
                Fortschritt:{' '}
                {progress.path === 'boss'
                  ? 'Einsatzleitung'
                  : progress.path === 'helper'
                    ? 'Helfer'
                    : 'Privat'}
              </p>
            ) : null}
          </div>
        </div>
        <SettingsHandbookLink />
      </div>
      <div className="mt-3">
        {wizardPath ? (
          <Button type="button" size="sm" variant={showResume ? 'default' : 'outline'} onClick={openWizard}>
            {showResume ? 'Einrichtung fortsetzen' : 'Wizard öffnen'}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Für Helfer ohne Wizard: Handoff-ZIP unter Allgemein → Import laden.
          </p>
        )}
      </div>
    </div>
  )
}
