'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import {
  OnboardingBossMailboxesStep,
  OnboardingBossChainStep,
  OnboardingBossEinsatzRulesStep,
  OnboardingBossNetworkPlanStep,
  OnboardingBossTelegramStepPanel,
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
  skipOnboardingStep,
  type OnboardingProgress,
  type OnboardingStepId,
} from '@/frontend/lib/onboarding-progress-store'
import {
  OnboardingWizardShell,
  stepTitleFor,
} from '@/frontend/components/onboarding/onboarding-wizard-shell'
import { onboardingStepHint } from '@/frontend/lib/onboarding-wizard-copy'
import { ensureInferredBossNetworkSetupPlan, isBossNetworkPlanStepChosen } from '@/frontend/lib/boss-wizard-network-plan'
import { STANDALONE_HANDOFF_APPLIED_EVENT } from '@/frontend/lib/handoff-standalone-ready'

export type OnboardingWizardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  sessionLocked?: boolean
  contactDirectory?: Record<string, import('@/frontend/lib/api').ContactMeshEntryClient>
  onActivateWallet?: () => void
  onOpenHandoffImport?: () => void
  onReloadStatus?: () => void
  /** Boss: nach „Fertig“ Readiness-Check anzeigen. */
  onBossSetupFinished?: () => void
  fallbackMyAddress?: string | null
}

function skipContext(api?: ApiStatus | null, sessionLocked?: boolean) {
  return buildOnboardingSkipContext(api, { uiLocked: sessionLocked ?? false })
}

export function OnboardingWizardDialog(p: OnboardingWizardDialogProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(() => readOnboardingProgress())
  const beforeAdvanceRef = useRef<(() => Promise<boolean>) | null>(null)
  const ctx = useMemo(
    () => skipContext(p.apiSnapshot, p.sessionLocked),
    [p.apiSnapshot, p.sessionLocked]
  )

  const syncProgress = useCallback(() => {
    setProgress(readOnboardingProgress())
  }, [])

  useEffect(() => {
    if (!p.open) beforeAdvanceRef.current = null
  }, [p.open])

  useEffect(() => {
    if (!p.open) return
    syncProgress()
    const prog = readOnboardingProgress()
    if (prog?.path === 'boss') {
      ensureInferredBossNetworkSetupPlan({
        hasPackageId: Boolean(p.apiSnapshot?.packageId?.trim()),
        apiStatus: p.apiSnapshot ?? undefined,
      })
    }
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
    sessionLocked: p.sessionLocked,
    fallbackMyAddress: p.fallbackMyAddress,
    onActivateWallet: p.onActivateWallet,
    onReload: p.onReloadStatus,
    onOpenHandoffImport: () => {
      p.onOpenChange(false)
      p.onOpenHandoffImport?.()
    },
    onRegisterBeforeAdvance: (fn: (() => Promise<boolean>) | null) => {
      beforeAdvanceRef.current = fn
    },
  }

  const advance = async (action: 'complete' | 'skip') => {
    if (!progress) return
    if (action === 'complete' && beforeAdvanceRef.current) {
      const ok = await beforeAdvanceRef.current()
      if (!ok) return
    }
    if (action === 'complete') markOnboardingStepComplete(stepId)
    else skipOnboardingStep(stepId)
    setProgress(readOnboardingProgress())
  }

  const handleFinish = () => {
    finishOnboarding()
    syncProgress()
    p.onOpenChange(false)
    if (path === 'boss') {
      p.onReloadStatus?.()
      p.onBossSetupFinished?.()
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
        case 'network-plan':
          return <OnboardingBossNetworkPlanStep {...panelProps} />
        case 'einsatz-rules':
          return <OnboardingBossEinsatzRulesStep {...panelProps} />
        case 'chain':
        case 'package':
          return <OnboardingBossChainStep {...panelProps} />
        case 'mailboxes':
          return <OnboardingBossMailboxesStep {...panelProps} />
        case 'telegram':
          return <OnboardingBossTelegramStepPanel {...panelProps} />
        case 'meshtastic':
          return <OnboardingMeshtasticStep {...panelProps} />
        case 'done':
          return <OnboardingDoneStep path="boss" />
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
          return <OnboardingDoneStep path="wanderer" />
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
          return <OnboardingDoneStep path="helper" />
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

  const nextDisabled =
    path === 'boss' && stepId === 'network-plan' && !isBossNetworkPlanStepChosen()

  return (
    <OnboardingWizardShell
      open={p.open}
      onOpenChange={p.onOpenChange}
      title={pathTitle}
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      stepTitle={stepTitleFor(stepId as OnboardingStepId, path)}
      stepHint={onboardingStepHint(path, stepId as OnboardingStepId)}
      showBack={stepIndex > 0}
      showSkip={stepId !== 'done'}
      showLater={stepId !== 'done'}
      onBack={handleBack}
      onSkip={() => advance('skip')}
      onLater={handleLater}
      onDismiss={() => dismissOnboarding()}
      onNext={stepId === 'done' ? handleFinish : () => void advance('complete')}
      nextLabel={stepId === 'done' ? 'Fertig' : 'Weiter'}
      nextDisabled={nextDisabled}
      showNextChevron={stepId !== 'done'}
    >
      <div className="max-h-[min(60vh,32rem)] overflow-y-auto pr-1">{renderStepBody()}</div>
    </OnboardingWizardShell>
  )
}
