import deCommon from '../../../locales/de/common.json'
import deStandalone from '../../../locales/de/standalone.json'
import deVault from '../../../locales/de/vault.json'
import deHelper from '../../../locales/de/helper.json'
import deDashboard from '../../../locales/de/dashboard.json'
import enCommon from '../../../locales/en/common.json'
import enStandalone from '../../../locales/en/standalone.json'
import enVault from '../../../locales/en/vault.json'
import enHelper from '../../../locales/en/helper.json'
import enDashboard from '../../../locales/en/dashboard.json'

export const APP_LOCALES = ['de', 'en'] as const
export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_APP_LOCALE: AppLocale = 'de'
export const LOCALE_STORAGE_KEY = 'morgendrot.locale'

export const i18nResources = {
  de: {
    common: deCommon,
    standalone: deStandalone,
    vault: deVault,
    helper: deHelper,
    dashboard: deDashboard,
  },
  en: {
    common: enCommon,
    standalone: enStandalone,
    vault: enVault,
    helper: enHelper,
    dashboard: enDashboard,
  },
} as const

export type AppNamespace = keyof (typeof i18nResources)['de']

export type I18nResources = (typeof i18nResources)['de']
