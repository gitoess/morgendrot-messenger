'use client'

import { useEffect, useState } from 'react'
import { getMessengerDashboardOfflineHint } from '@/frontend/lib/dashboard-basis-offline-hint'
import { useTranslation } from 'react-i18next'

export function MessengerDashboardOfflineHint() {
  const { i18n } = useTranslation()
  const [hint, setHint] = useState(() => getMessengerDashboardOfflineHint())

  useEffect(() => {
    const sync = () => setHint(getMessengerDashboardOfflineHint())
    sync()
    i18n.on('languageChanged', sync)
    return () => {
      i18n.off('languageChanged', sync)
    }
  }, [i18n])

  return <p className="text-sm leading-relaxed text-amber-400">{hint}</p>
}
