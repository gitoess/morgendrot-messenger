'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { APP_LOCALES, type AppLocale } from '@/frontend/lib/i18n'
import { LOCALE_FLAG_ICONS } from '@/frontend/components/locale-flag-icons'
import { useAppLocale, useAppTranslation, useSetAppLocale } from '@/frontend/lib/i18n/hooks'

/** Sprachwahl mit SVG-Flaggen — Entsperr-Dialog, Einstellungen. */
export function LocaleFlagSwitch(p: {
  className?: string
  /** Mit Sprachname daneben (Einstellungen). */
  showLabels?: boolean
  size?: 'sm' | 'md'
}) {
  const { t } = useAppTranslation('common')
  const locale = useAppLocale()
  const setLocale = useSetAppLocale()
  const [pending, setPending] = useState<AppLocale | null>(null)
  const size = p.size ?? 'md'
  const flagBox =
    size === 'sm' ? 'h-5 w-7 rounded-[3px]' : 'h-6 w-9 rounded-[4px]'

  const onPick = (lng: AppLocale) => {
    if (lng === locale || pending === lng) return
    setPending(lng)
    void setLocale(lng).finally(() => setPending(null))
  }

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', p.className)}
      role="group"
      aria-label={t('language.switchAria')}
    >
      {APP_LOCALES.map((lng) => {
        const Flag = LOCALE_FLAG_ICONS[lng]
        const active = locale === lng
        return (
          <button
            key={lng}
            type="button"
            onClick={() => onPick(lng)}
            disabled={pending !== null && pending !== lng}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg transition-all',
              p.showLabels ? 'px-3 py-2' : 'p-1',
              active
                ? 'bg-primary/15 ring-2 ring-primary ring-offset-2 ring-offset-background'
                : 'opacity-75 hover:bg-accent hover:opacity-100',
              pending === lng && 'scale-95 opacity-50'
            )}
            aria-pressed={active}
            aria-label={t(`language.${lng}`)}
            title={t(`language.${lng}`)}
          >
            <span
              className={cn(
                'shrink-0 overflow-hidden shadow-sm ring-1 ring-black/15 dark:ring-white/20',
                flagBox
              )}
            >
              <Flag />
            </span>
            {p.showLabels ? (
              <span className="text-sm font-medium text-foreground">{t(`language.${lng}`)}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
