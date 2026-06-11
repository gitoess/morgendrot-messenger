'use client'

import { Crown } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

export type EinsatzleitungHubProps = {
  apiStatus?: ApiStatus | null
}

export function EinsatzleitungHub(p: EinsatzleitungHubProps) {
  const { t } = useAppTranslation('dashboard')

  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Crown className="h-4 w-4 text-amber-600" aria-hidden />
      {t('einsatzHub.title')}
    </p>
  )
}
