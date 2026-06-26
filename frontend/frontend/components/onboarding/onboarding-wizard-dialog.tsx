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
  OnboardingBossWalletStep,
  OnboardingDoneStep,
  OnboardingHelperHandoffStep,
  OnboardingHelperPeeringStep,
  OnboardingHelperTeamSelfStep,
  OnboardingHelperTelegramStep,
  OnboardingHelperWalletStep,
  OnboardingMeshtasticStep,
  OnboardingWandererAddressStep,
  OnboardingWandererMailboxStep,
  OnboardingWandererWalletStep,
} from '@/frontend/components/onboarding/onboarding-inline-step-panels'
import {
  buildOnboardingSkipContext,
  dismissOnboarding,
  finishOnboarding,
  getWizardViewStep,
  goBackOnboardingStep,
  markOnboardingStepComplete,
  ONBOARDING_PROGRESS_CHANGED_EVENT,
  readOnboardingProgress,
  type OnboardingProgress,
  type OnboardingStepId,
} from '@/frontend/lib/onboarding-progress-store'
import {
  OnboardingWizardShell,
  stepTitleFor,
} from '@/frontend/components/onboarding/onboarding-wizard-shell'
import { STANDALONE_HANDOFF_APPLIED_EVENT } from '@/frontend/lib/handoff-standalone-ready'

export type OnboardingWizardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  contactDirectory?: Record<string, import('@/frontend/lib/api').ContactMeshEntryClient>
  onActivateWallet?: () => void
  onOpenHandoffImport?: () => void
  onReloadStatus?: () => void
}

function skipContext(api?: ApiStatus | null) {
  return buildOnboardingSkipContext(api)
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
    const onHandoff = () => p.onReloadStatus?.()
    const onProgress = () => syncProgress()
    window.addEventListener(STANDALONE_HANDOFF_APPLIED_EVENT, onHandoff)
    window.addEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, onProgress)
    return () => {
      window.removeEventListener(STANDALONE_HANDOFF_APPLIED_EVENT, onHandoff)
      window.removeEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, onProgress)
    }
  }, [p.open, p.onReloadStatus, syncProgress])

  const active = progress ? getWizardViewStep(progress) : null
  const path = progress?.path ?? 'boss'
  const stepId = active?.stepId ?? 'done'
  const stepIndex = active?.index ?? 0
  const stepTotal = active?.total ?? 1

  const panelProps = {
    apiSnapshot: p.apiSnapshot,
    backendOnline: p.backendOnline,
    contactDirectory: p.contactDirectory,
    onActivateWallet: p.onActivateWallet,
    onReload: p.onReloadStatus,
    onOpenHandoffImport: p.onOpenHandoffImport,
  }

  const advance = (action: 'complete' | 'skip') => {
    if (!progress) return
    if (action === 'complete') markOnboardingStepComplete(stepId)
    else skipOnboardingStep(stepId)
    const next = readOnboardingProgress()
    setProgress(next)
    if (action === 'complete' && next) {
      const nextView = getWizardViewStep(next)
      if (nextView.stepId === 'done') finishOnboarding()
    }
  }

  const handleBack = () => {
    if (!progress || stepIndex <= 0) return
    goBackOnboardingStep(stepId)
    syncProgress()
  }

  const handleLater = () => {
    dismissOnboarding()
    p.onOpenChange(false)
  }

  const pathTitle =
    path === 'boss'
      ? 'Einsatzleitung einrichten'
      : path === 'helper'
        ? 'Helfer einrichten'
        : path === 'wanderer'
          ? 'Privat einrichten'
          : 'Einrichtung'

  const renderStepBody = () => {
    if (path === 'boss') {
      switch (stepId) {
        case 'wallet':
          return <OnboardingBossWalletStep {...panelProps} />
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

    if (path === 'helper') {
      switch (stepId) {
        case 'handoff':
          return <OnboardingHelperHandoffStep {...panelProps} />
        case 'telegram':
          return <OnboardingHelperTelegramStep />
        case 'wallet':
          return <OnboardingHelperWalletStep {...panelProps} />
        case 'team-self':
          return <OnboardingHelperTeamSelfStep {...panelProps} />
        case 'peering':
          return <OnboardingHelperPeeringStep {...panelProps} />
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
        Wizard-Pfad unbekannt — Einstellungen → Einrichtung fortsetzen.
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
      <div className="max-h-[min(60vh,32rem)] overflow-y-auto pr-1">{renderStepBody()}</div>
    </OnboardingWizardShell>
  )
}
