export {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  LOCALE_STORAGE_KEY,
  i18nResources,
  type AppLocale,
  type AppNamespace,
} from '@/frontend/lib/i18n/resources'
export {
  APP_LOCALE_CHANGED_EVENT,
  ensureI18nInitialized,
  ensureI18nReady,
  getAppLocale,
  getSharedI18n,
  i18n,
  normalizeAppLocale,
  setAppLocale,
} from '@/frontend/lib/i18n/client'
export { useAppTranslation, useAppLocale, useSetAppLocale, Trans } from '@/frontend/lib/i18n/hooks'
