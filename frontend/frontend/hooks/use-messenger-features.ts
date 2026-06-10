'use client'

import { useMemo } from 'react'
import {
  messengerFeatureShells,
  type DashboardFeature,
} from '@/frontend/components/dashboard-features-messenger'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

export function useMessengerFeatures(): DashboardFeature[] {
  const { t, i18n } = useAppTranslation('dashboard')
  return useMemo(
    () =>
      messengerFeatureShells.map((shell) => ({
        ...shell,
        title: t(`features.${shell.id}.title`),
        subtitle: t(`features.${shell.id}.subtitle`),
        variants: shell.variants.map((variant) => ({
          ...variant,
          title: t(`features.${shell.id}.variants.${variant.id}.title`),
          hint: t(`features.${shell.id}.variants.${variant.id}.hint`),
        })),
      })),
    [t, i18n.language]
  )
}
