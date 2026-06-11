import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppNamespace } from '@/frontend/lib/i18n/resources'
import {
  APP_LOCALE_CHANGED_EVENT,
  getAppLocale,
  getSharedI18n,
  setAppLocale,
  type AppLocale,
} from '@/frontend/lib/i18n/client'

const translationDefaults = {
  useSuspense: false,
  bindI18n: 'languageChanged loaded',
  bindI18nStore: 'added removed',
} as const

/** Typed translation hook — default namespace `common`. */
export function useAppTranslation<N extends AppNamespace = 'common'>(ns?: N) {
  return useTranslation(ns, translationDefaults)
}

/** Aktuelle Sprache — re-rendert bei languageChanged. */
export function useAppLocale(): AppLocale {
  const { i18n } = useTranslation()
  const [locale, setLocale] = useState<AppLocale>(() => getAppLocale(getSharedI18n()))

  useEffect(() => {
    const shared = getSharedI18n()
    const sync = () => setLocale(getAppLocale(shared))
    sync()
    shared.on('languageChanged', sync)
    i18n.on('languageChanged', sync)
    window.addEventListener(APP_LOCALE_CHANGED_EVENT, sync)
    return () => {
      shared.off('languageChanged', sync)
      i18n.off('languageChanged', sync)
      window.removeEventListener(APP_LOCALE_CHANGED_EVENT, sync)
    }
  }, [i18n])

  return locale
}

/** Sprache wechseln — immer über die globale Singleton-Instanz. */
export function useSetAppLocale(): (locale: AppLocale) => Promise<void> {
  const { i18n } = useTranslation()
  return useCallback((locale: AppLocale) => setAppLocale(locale, getSharedI18n()), [i18n])
}

export { Trans } from 'react-i18next'
