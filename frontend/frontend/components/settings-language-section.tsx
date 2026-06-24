'use client'

import { Languages } from 'lucide-react'
import { LocaleFlagSwitch } from '@/frontend/components/locale-flag-switch'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

export function SettingsLanguageSection() {
  const { t } = useAppTranslation('common')

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
          <Languages className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-foreground">{t('language.sectionTitle')}</h4>
        </div>
      </div>
      <LocaleFlagSwitch showLabels size="md" />
    </div>
  )
}
