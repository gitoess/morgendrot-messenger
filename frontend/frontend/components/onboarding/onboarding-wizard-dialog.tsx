'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { Button } from '@/components/ui/button'
import {
  OnboardingBossAddressStep,
  OnboardingBossHelpersStep,
  OnboardingBossPackageStep,
  OnboardingBossServerMailboxStep,
  OnboardingBossTeamStep,
  OnboardingBossTelegramBotStep,
  OnboardingBossTelegramGroupStep,
  OnboardingDoneStep,
  OnboardingMeshtasticStep,
  OnboardingWandererAddressStep,
  OnboardingWandererMailboxStep,
  OnboardingWandererWalletStep,
} from '@/frontend/components/onboarding/onboarding-inline-step-panels'
import {
  dismissOnboarding,
  finishOnboarding,
  getActiveOnboardingStep,
  markOnboardingStepComplete,
  readOnboardingProgress,
  setOnboardingStepIndex,
  skipOnboardingStep,
  type OnboardingProgress,
  type OnboardingSkipContext,
  type OnboardingStepId,
} from '@/frontend/lib/onboarding-progress-store'
import {
  OnboardingWizardShell,
  stepTitleFor,
} from '@/frontend/components/onboarding/onboarding-wizard-shell'

export type OnboardingWizardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  onActivateWallet?: () => void
  onReloadStatus?: () => void
}

function skipContext(api?: ApiStatus | null): OnboardingSkipContext {
  return {
    role: api?.role,
    hasPackageId: Boolean(api?.packageId?.trim()),
    hasMailboxId: Boolean(api?.mailboxId?.trim()),
    hasTeamId: Boolean(api?.handoffLabel?.trim()),
  }
}

export function OnboardingWizardDialog(p: OnboardingWizardDialogProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(() => readOnboardingProgress())
  const ctx = useMemo(() => skipContext(p.apiSnapshot), [p.apiSnapshot])

  const syncProgress = useCallback(() => {
    setProgress(readOnboardingProgress())
  }, [])

  useEffect(() => {
    if (!p.open) return
    syncProgress()
  }, [p.open, syncProgress])

  const active = progress ? getActiveOnboardingStep(progress, ctx) : null
  const path = progress?.path ?? 'boss'
  const stepId = active?.stepId ?? 'done'
  const stepIndex = active?.index ?? 0
  const stepTotal = active?.total ?? 1

  const panelProps = {
    apiSnapshot: p.apiSnapshot,
    backendOnline: p.backendOnline,
    onActivateWallet: p.onActivateWallet,
    onReload: p.onReloadStatus,
  }

  const advance = (action: 'complete' | 'skip') => {
    if (!progress) return
    if (action === 'complete') markOnboardingStepComplete(stepId)
    else skipOnboardingStep(stepId)
    const next = readOnboardingProgress()
    setProgress(next)
    const nextActive = next ? getActiveOnboardingStep(next, ctx) : null
    if (!nextActive || nextActive.stepId === 'done') finishOnboarding()
  }

  const handleBack = () => {
    if (stepIndex > 0) setOnboardingStepIndex(stepIndex - 1)
    syncProgress()
  }

  const handleLater = () => {
    dismissOnboarding()
    p.onOpenChange(false)
  }

  const pathTitle = path === 'boss' ? 'Einsatzleitung einrichten' : path === 'wanderer' ? 'Privat einrichten' : 'Einrichtung'

  const renderStepBody = () => {
    if (path === 'boss') {
      switch (stepId) {
        case 'address':
          return <OnboardingBossAddressStep {...panelProps} />
        case 'package':
          return <OnboardingBossPackageStep {...panelProps} />
        case 'server-mailbox':
          return <OnboardingBossServerMailboxStep {...panelProps} />
        case 'team':
          return <OnboardingBossTeamStep {...panelProps} />
        case 'telegram-bot':
          return <OnboardingBossTelegramBotStep {...panelProps} />
        case 'telegram-group':
          return <OnboardingBossTelegramGroupStep {...panelProps} />
        case 'meshtastic':
          return <OnboardingMeshtasticStep {...panelProps} />
        case 'helpers':
          return <OnboardingBossHelpersStep {...panelProps} />
        case 'done':
          return (
            <OnboardingDoneStep>
              <Button type="button" onClick={() => p.onOpenChange(false)}>
                Schließen
              </Button>
            </OnboardingDoneStep>
          )
        default:
          return null
      }
    }

    if (path === 'wanderer') {
      switch (stepId) {
        case 'wallet':
          return <OnboardingWandererWalletStep {...panelProps} />
        case 'address':
          return <OnboardingWandererAddressStep {...panelProps} />
        case 'private-mailbox':
          return <OnboardingWandererMailboxStep {...panelProps} />
        case 'meshtastic':
          return <OnboardingMeshtasticStep {...panelProps} />
        case 'done':
          return (
            <OnboardingDoneStep>
              <Button type="button" onClick={() => p.onOpenChange(false)}>
                Schließen
              </Button>
            </OnboardingDoneStep>
          )
        default:
          return null
      }
    }

    return (
      <p className="text-sm text-muted-foreground">
        Für Helfer: Handoff-ZIP vom Boss importieren (Einstellungen → Import).
      </p>
    )
  }

  if (!progress) return null

  return (
    <OnboardingWizardShell
      open={p.open}
      onOpenChange={p.onOpenChange}
      title={pathTitle}
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      stepTitle={stepTitleFor(stepId as OnboardingStepId, path)}
      showBack={stepIndex > 0 && stepId !== 'done'}
      showSkip={stepId !== 'done'}
      showLater={stepId !== 'done'}
      onBack={handleBack}
      onSkip={() => advance('skip')}
      onLater={handleLater}
      onNext={stepId === 'done' ? () => p.onOpenChange(false) : () => advance('complete')}
      nextLabel={stepId === 'done' ? 'Fertig' : 'Weiter'}
    >
      <div className="max-h-[50vh] overflow-y-auto pr-1">{renderStepBody()}</div>
    </OnboardingWizardShell>
  )
}
