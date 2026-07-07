'use client'

import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { OnboardingBossReadinessDialog } from '@/frontend/components/onboarding/onboarding-boss-readiness-dialog'
import { OnboardingWizardDialog } from '@/frontend/components/onboarding/onboarding-wizard-dialog'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { clearStuckRadixBodyLock } from '@/frontend/lib/release-modal-pointer-events'
import {
  ONBOARDING_WIZARD_OPEN_REQUEST_EVENT,
  prepareOnboardingWizardOpen,
  resolveOnboardingDialogPath,
} from '@/frontend/lib/onboarding-progress-store'
import { readStandaloneOnboardingPath } from '@/frontend/lib/standalone-onboarding'

export function OnboardingWizardHost(p: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  sessionLocked?: boolean
  contactDirectory?: Record<string, import('@/frontend/lib/api').ContactMeshEntryClient>
  onActivateWallet?: () => void
  onOpenHandoffImport?: () => void
  onReloadStatus?: () => void
  fallbackMyAddress?: string | null
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [readinessOpen, setReadinessOpen] = useState(false)
  const controlled = p.open !== undefined
  const open = (controlled ? p.open : uncontrolledOpen) ?? false

  const setWizardOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next)
      p.onOpenChange?.(next)
    },
    [controlled, p.onOpenChange]
  )

  useEffect(() => {
    const onOpen = () => {
      const path = resolveOnboardingDialogPath({
        role: p.apiSnapshot?.role,
        standalonePath: readStandaloneOnboardingPath(),
      })
      if (!path) return
      prepareOnboardingWizardOpen(path)
      if (isCapacitorNativePlatform()) clearStuckRadixBodyLock()
      flushSync(() => setWizardOpen(true))
    }
    window.addEventListener(ONBOARDING_WIZARD_OPEN_REQUEST_EVENT, onOpen)
    return () => window.removeEventListener(ONBOARDING_WIZARD_OPEN_REQUEST_EVENT, onOpen)
  }, [p.apiSnapshot?.role, setWizardOpen])

  return (
    <>
      <OnboardingWizardDialog
        open={open}
        onOpenChange={setWizardOpen}
        apiSnapshot={p.apiSnapshot}
        backendOnline={p.backendOnline}
        sessionLocked={p.sessionLocked}
        contactDirectory={p.contactDirectory}
        onActivateWallet={p.onActivateWallet}
        onOpenHandoffImport={p.onOpenHandoffImport}
        onReloadStatus={p.onReloadStatus}
        fallbackMyAddress={p.fallbackMyAddress}
        onBossSetupFinished={() => setReadinessOpen(true)}
      />
      <OnboardingBossReadinessDialog
        open={readinessOpen}
        onOpenChange={setReadinessOpen}
        apiSnapshot={p.apiSnapshot}
        sessionLocked={p.sessionLocked}
        fallbackMyAddress={p.fallbackMyAddress}
        onReloadStatus={p.onReloadStatus}
      />
    </>
  )
}
