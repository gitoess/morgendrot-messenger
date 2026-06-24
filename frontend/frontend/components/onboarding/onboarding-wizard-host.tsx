'use client'

import { useEffect, useState } from 'react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { OnboardingWizardDialog } from '@/frontend/components/onboarding/onboarding-wizard-dialog'
import {
  ONBOARDING_WIZARD_OPEN_REQUEST_EVENT,
  readOnboardingProgress,
  resolveWizardOnboardingPath,
  startOnboarding,
} from '@/frontend/lib/onboarding-progress-store'
import { readStandaloneOnboardingPath } from '@/frontend/lib/standalone-onboarding'

export function OnboardingWizardHost(p: {
  apiSnapshot?: ApiStatus | null
  backendOnline?: boolean
  contactDirectory?: Record<string, import('@/frontend/lib/api').ContactMeshEntryClient>
  onActivateWallet?: () => void
  onReloadStatus?: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onOpen = () => {
      const path = resolveWizardOnboardingPath({
        role: p.apiSnapshot?.role,
        standalonePath: readStandaloneOnboardingPath(),
      })
      if (!path) return
      if (!readOnboardingProgress() || readOnboardingProgress()?.path !== path) {
        startOnboarding(path)
      }
      setOpen(true)
    }
    window.addEventListener(ONBOARDING_WIZARD_OPEN_REQUEST_EVENT, onOpen)
    return () => window.removeEventListener(ONBOARDING_WIZARD_OPEN_REQUEST_EVENT, onOpen)
  }, [p.apiSnapshot?.role])

  return (
    <OnboardingWizardDialog
      open={open}
      onOpenChange={setOpen}
      apiSnapshot={p.apiSnapshot}
      backendOnline={p.backendOnline}
      contactDirectory={p.contactDirectory}
      onActivateWallet={p.onActivateWallet}
      onReloadStatus={p.onReloadStatus}
    />
  )
}
