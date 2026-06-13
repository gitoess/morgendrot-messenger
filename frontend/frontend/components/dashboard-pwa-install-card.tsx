'use client'

/**
 * PWA-Installation — kurz auf dem Dashboard.
 */

import { useState, useEffect } from 'react'
import { Smartphone } from 'lucide-react'
import { shouldShowDashboardPwaInstallCard } from '@/frontend/lib/should-show-pwa-install'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

type DeferredPwaPrompt = {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function DashboardPwaInstallCard({
  compact = false,
  inline = false,
}: {
  compact?: boolean
  /** Schmale Kachel in der obersten Zeile neben IOTA Wallet. */
  inline?: boolean
}) {
  const { t } = useAppTranslation('dashboard')
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<DeferredPwaPrompt | null>(null)
  const [pwaStandalone, setPwaStandalone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(display-mode: standalone)')
    const syncStandalone = () => {
      setPwaStandalone(
        mq.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      )
    }
    syncStandalone()
    mq.addEventListener('change', syncStandalone)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPwaPrompt(e as unknown as DeferredPwaPrompt)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => {
      mq.removeEventListener('change', syncStandalone)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  const handlePwaInstallClick = async () => {
    if (!deferredPwaPrompt) return
    try {
      await deferredPwaPrompt.prompt()
      await deferredPwaPrompt.userChoice
    } finally {
      setDeferredPwaPrompt(null)
    }
  }

  if (!shouldShowDashboardPwaInstallCard() || pwaStandalone) return null

  if (inline) {
    return (
      <div
        id="dashboard-pwa-install"
        className="flex w-full shrink-0 flex-col justify-between rounded-xl border border-border/80 bg-card/60 p-2.5 sm:w-[132px]"
      >
        <div className="flex items-center gap-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
          </div>
          <span className="text-[11px] font-semibold leading-tight text-foreground">{t('cards.pwaShort')}</span>
        </div>
        <p className="mt-1 text-[9px] leading-snug text-muted-foreground">{t('pwa.offlineHint')}</p>
        {deferredPwaPrompt ? (
          <button
            type="button"
            onClick={() => void handlePwaInstallClick()}
            className="mt-2 w-full rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('pwa.install')}
          </button>
        ) : (
          <p className="mt-2 text-[9px] text-muted-foreground/80">{t('pwa.browserMenu')}</p>
        )}
      </div>
    )
  }

  if (compact) {
    return (
      <div id="dashboard-pwa-install" className="rounded-xl border border-border/80 bg-card/60 p-3">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Smartphone className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">{t('cards.pwaInstall')}</h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t('pwa.offlineDetail')}</p>
            {deferredPwaPrompt ? (
              <button
                type="button"
                onClick={() => void handlePwaInstallClick()}
                className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t('pwa.install')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id="dashboard-pwa-install" className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Smartphone className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h4 className="font-semibold text-foreground">{t('cards.pwaInstall')}</h4>
          <p className="text-sm text-muted-foreground">{t('pwa.fullDescription')}</p>
          {deferredPwaPrompt ? (
            <button
              type="button"
              onClick={() => void handlePwaInstallClick()}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('pwa.installApp')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
