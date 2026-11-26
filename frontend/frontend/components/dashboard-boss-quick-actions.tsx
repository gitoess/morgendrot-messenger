'use client'

import { ArrowRight, Crown, MessageSquare, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'
import { IOTA_MESSENGER_UI } from '@/frontend/lib/product-identity'

import { DashboardSosEmergencyButton } from '@/frontend/components/dashboard-sos-emergency-button'

const cardBase =
  'flex min-h-[148px] flex-col gap-3 rounded-2xl border p-5 text-left transition-colors hover:brightness-110'

export function DashboardBossQuickActions(p: {
  onOpenMessages: () => void
  onOpenIota: () => void
  onOpenEinsatzleitung: () => void
  /** Einsatzleitung-Kachel (Morgendrot); IOTA-Edition: aus. */
  showEinsatzleitung?: boolean
  sosApiStatus?: Parameters<typeof DashboardSosEmergencyButton>[0]['apiStatus']
  sosContactDirectory?: Parameters<typeof DashboardSosEmergencyButton>[0]['contactDirectory']
  sosMyAddress?: string
}) {
  const { t } = useAppTranslation('dashboard')
  const showEinsatz = p.showEinsatzleitung !== false && !IOTA_MESSENGER_UI.hideEinsatzleitung
  const showSos = !IOTA_MESSENGER_UI.hideSos

  return (
    <section aria-label={t('bossQuickActions.aria')}>
      <h2 className="sr-only">{t('bossQuickActions.aria')}</h2>
      <div className={cn('grid gap-3', showEinsatz ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        <button
          type="button"
          onClick={p.onOpenMessages}
          className={cn(
            cardBase,
            'border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 to-transparent'
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400">
            <MessageSquare className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{t('bossQuickActions.messages.title')}</p>
            <p className="text-sm text-muted-foreground">{t('bossQuickActions.messages.subtitle')}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300/90">
            {t('bossQuickActions.open')} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
        <button
          type="button"
          onClick={p.onOpenIota}
          className={cn(
            cardBase,
            'border-sky-500/40 bg-gradient-to-br from-sky-500/15 to-transparent'
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/20 text-sky-300">
            <Wallet className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">
              {t('bossQuickActions.iota.title', { defaultValue: 'IOTA Wallet' })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('bossQuickActions.iota.subtitle', {
                defaultValue: 'Überweisen, Empfangen, Aktivität',
              })}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-200/90">
            {t('bossQuickActions.open')} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
        {showEinsatz ? (
          <button
            type="button"
            onClick={p.onOpenEinsatzleitung}
            className={cn(
              cardBase,
              'border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-transparent'
            )}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-400">
              <Crown className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{t('bossQuickActions.einsatzleitung.title')}</p>
              <p className="text-sm text-muted-foreground">{t('bossQuickActions.einsatzleitung.subtitle')}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-200/90">
              {t('bossQuickActions.open')} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </button>
        ) : null}
      </div>
      {showSos ? (
        <div className="mt-6 flex justify-end">
          <DashboardSosEmergencyButton
            onOpenMessages={p.onOpenMessages}
            apiStatus={p.sosApiStatus}
            contactDirectory={p.sosContactDirectory}
            myAddress={p.sosMyAddress}
          />
        </div>
      ) : null}
    </section>
  )
}
