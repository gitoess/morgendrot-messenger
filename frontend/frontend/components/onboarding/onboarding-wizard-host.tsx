'use client'

import { useEffect, useState } from 'react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { OnboardingWizardDialog } from '@/frontend/components/onboarding/onboarding-wizard-dialog'
import {
  ONBOARDING_WIZARD_OPEN_REQUEST_EVENT,
  readOnboardingProgress,
  resolveOnboardingPath,
  startOnboarding,
} from '@/frontend/lib/onboarding-progress-store'
import { readStandaloneOnboardingPath } from '@/frontend/lib/standalone-onboarding'

export function OnboardingWizardHost(p: {
  apiSnapshot?: ApiStatus | null
  onOpenSettings?: () => void
  onOpenEinsatzleitung?: () => void
  onActivateWallet?: () => void
  onOpenChat?: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onOpen = () => {
      if (!readOnboardingProgress()) {
        const path = resolveOnboardingPath({
          role: p.apiSnapshot?.role,
          standalonePath: readStandaloneOnboardingPath(),
        })
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
      onOpenSettings={p.onOpenSettings}
      onOpenEinsatzleitung={p.onOpenEinsatzleitung}
      onOpenHandoffImport={p.onOpenSettings}
      onActivateWallet={p.onActivateWallet}
      onOpenChat={p.onOpenChat}
    />
  )
}
