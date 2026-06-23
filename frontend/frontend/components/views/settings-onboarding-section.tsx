'use client'

import { useEffect, useState } from 'react'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApiStatus } from '@/frontend/lib/api/status'
import {
  needsOnboardingResume,
  ONBOARDING_PROGRESS_CHANGED_EVENT,
  readOnboardingProgress,
  requestOpenOnboardingWizard,
  resolveOnboardingPath,
  startOnboarding,
  type OnboardingSkipContext,
} from '@/frontend/lib/onboarding-progress-store'

export function SettingsOnboardingSection(p: { apiStatus?: ApiStatus | null }) {
  const [, bump] = useState(0)
  const ctx: OnboardingSkipContext = {
    role: p.apiStatus?.role,
    hasPackageId: Boolean(p.apiStatus?.packageId?.trim()),
    hasMailboxId: Boolean(p.apiStatus?.mailboxId?.trim()),
    hasTeamId: Boolean(p.apiStatus?.handoffLabel?.trim()),
  }

  useEffect(() => {
    const sync = () => bump((n) => n + 1)
    window.addEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, sync)
    return () => window.removeEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, sync)
  }, [])

  const progress = readOnboardingProgress()
  const showResume = needsOnboardingResume(ctx)

  const openWizard = () => {
    if (!readOnboardingProgress()) {
      const path = resolveOnboardingPath({ role: p.apiStatus?.role })
      startOnboarding(path)
    }
    requestOpenOnboardingWizard()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
          <Compass className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h4 className="font-semibold text-foreground">Einstiegs-Wizard (§ H.36)</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Geführter Erststart — Handoff, Wallet, Telegram und Peering in festen Schritten.
            </p>
          </div>
          {showResume && progress ? (
            <p className="text-xs text-muted-foreground">
              Fortschritt: {progress.path === 'boss' ? 'Boss' : progress.path === 'helper' ? 'Helfer' : 'Privat'}
            </p>
          ) : null}
          <Button type="button" size="sm" variant={showResume ? 'default' : 'outline'} onClick={openWizard}>
            {showResume ? 'Einrichtung fortsetzen' : 'Wizard öffnen'}
          </Button>
        </div>
      </div>
    </div>
  )
}
