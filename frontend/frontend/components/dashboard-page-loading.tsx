'use client'

import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

export function DashboardPageLoading() {
  const { t } = useAppTranslation('dashboard')
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center text-muted-foreground">
      <p className="text-sm font-medium text-foreground">{t('loading.title')}</p>
      <p className="text-xs">{t('loading.subtitle')}</p>
    </div>
  )
}
