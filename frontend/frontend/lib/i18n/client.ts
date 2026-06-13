import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  i18nResources,
  LOCALE_STORAGE_KEY,
  type AppLocale,
} from '@/frontend/lib/i18n/resources'
import '@/frontend/lib/i18n/types'

export const APP_LOCALE_CHANGED_EVENT = 'morgendrot.appLocaleChanged' as const

declare global {
  var __MORGENDROT_I18N__: typeof i18next | undefined
}

if (typeof globalThis !== 'undefined' && !globalThis.__MORGENDROT_I18N__) {
  globalThis.__MORGENDROT_I18N__ = i18next
}

let initPromise: Promise<typeof i18next> | null = null

const baseInitOptions = {
  resources: i18nResources,
  fallbackLng: DEFAULT_APP_LOCALE,
  supportedLngs: [...APP_LOCALES],
  nonExplicitSupportedLngs: true,
  load: 'languageOnly' as const,
  ns: ['common', 'standalone', 'vault', 'helper', 'dashboard'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  react: {
    useSuspense: false,
    bindI18n: 'languageChanged loaded',
    bindI18nStore: 'added removed',
  },
}

/** Eine Instanz über Chunks/HMR — Provider und setAppLocale müssen dieselbe sein. */
export function getSharedI18n(): typeof i18next {
  if (typeof globalThis !== 'undefined' && globalThis.__MORGENDROT_I18N__) {
    return globalThis.__MORGENDROT_I18N__
  }
  return i18next
}

export const i18n = getSharedI18n()

function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return DEFAULT_APP_LOCALE
  try {
    const v = window.localStorage.getItem(LOCALE_STORAGE_KEY)?.trim()
    if (v === 'en' || v === 'de') return v
  } catch {
    /* ignore */
  }
  return DEFAULT_APP_LOCALE
}

function startI18nInit(): Promise<typeof i18next> {
  const shared = getSharedI18n()
  if (shared.isInitialized) return Promise.resolve(shared)
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (shared.isInitialized) return shared

    const lng = typeof window === 'undefined' ? DEFAULT_APP_LOCALE : readStoredLocale()

    await shared.use(initReactI18next).init({
      ...baseInitOptions,
      lng,
    })

    return shared
  })()

  return initPromise
}

/** Sync — startet Init; für lib-Code der i18n.t ohne await nutzt. */
export function ensureI18nInitialized(): typeof i18next {
  void startI18nInit()
  return getSharedI18n()
}

/** Wartet bis i18n bereit ist (Provider, Sprachwechsel). */
export async function ensureI18nReady(): Promise<typeof i18next> {
  return startI18nInit()
}

export function normalizeAppLocale(raw: string | undefined | null): AppLocale {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .split('-')[0]
  return base === 'en' ? 'en' : 'de'
}

export async function setAppLocale(
  locale: AppLocale,
  instance?: typeof i18next
): Promise<void> {
  const shared = getSharedI18n()
  const i18nInstance = instance ?? shared
  await ensureI18nReady()
  await i18nInstance.changeLanguage(locale)
  if (i18nInstance !== shared) {
    await shared.changeLanguage(locale)
  }
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APP_LOCALE_CHANGED_EVENT, { detail: locale }))
  }
}

export function getAppLocale(instance?: typeof i18next): AppLocale {
  const i18nInstance = instance ?? getSharedI18n()
  return normalizeAppLocale(i18nInstance.language || i18nInstance.resolvedLanguage)
}

export type { AppLocale } from '@/frontend/lib/i18n/resources'
