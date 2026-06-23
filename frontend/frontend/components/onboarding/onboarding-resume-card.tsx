'use client'

import { useEffect, useMemo, useState } from 'react'
import { Compass, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ApiStatus } from '@/frontend/lib/api/status'
import {
  needsOnboardingResume,
  onboardingProgressPercent,
  readOnboardingProgress,
  requestOpenOnboardingWizard,
  ONBOARDING_PROGRESS_CHANGED_EVENT,
  type OnboardingSkipContext,
} from '@/frontend/lib/onboarding-progress-store'

export function OnboardingResumeCard(p: {
  apiSnapshot?: ApiStatus | null
  className?: string
}) {
  const [, bump] = useState(0)
  const ctx: OnboardingSkipContext = useMemo(
    () => ({
      role: p.apiSnapshot?.role,
      hasPackageId: Boolean(p.apiSnapshot?.packageId?.trim()),
      hasMailboxId: Boolean(p.apiSnapshot?.mailboxId?.trim()),
      hasMeshNodeId: Boolean(p.apiSnapshot?.meshNodeId?.trim()),
      hasTeamId: Boolean(p.apiSnapshot?.handoffLabel?.trim()),
    }),
    [p.apiSnapshot]
  )

  useEffect(() => {
    const sync = () => bump((n) => n + 1)
    window.addEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, sync)
    return () => window.removeEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, sync)
  }, [])

  const progress = readOnboardingProgress()
  if (!progress || !needsOnboardingResume(ctx)) return null

  const pct = onboardingProgressPercent(progress, ctx)
  const pathLabel =
    progress.path === 'boss' ? 'Einsatzleitung' : progress.path === 'helper' ? 'Helfer' : 'Privat'

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
              {pathLabel}-Wizard — {pct}% erledigt. Schritte sind überspringbar.
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
