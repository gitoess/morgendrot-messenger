'use client'

import { useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { ensureI18nReady, getSharedI18n, normalizeAppLocale } from '@/frontend/lib/i18n/client'

function syncDocumentLang(lng: string) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = normalizeAppLocale(lng)
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const shared = getSharedI18n()

    void ensureI18nReady()
      .then(() => {
        if (cancelled) return
        setReady(true)
        syncDocumentLang(shared.language || shared.resolvedLanguage || 'de')
      })
      .catch((e) => {
        console.warn('[i18n] Init fehlgeschlagen — UI trotzdem anzeigen.', e)
        if (!cancelled) setReady(true)
      })

    const onChange = (lng: string) => syncDocumentLang(lng)
    shared.on('languageChanged', onChange)

    return () => {
      cancelled = true
      shared.off('languageChanged', onChange)
    }
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        …
      </div>
    )
  }

  return <I18nextProvider i18n={getSharedI18n()}>{children}</I18nextProvider>
}
