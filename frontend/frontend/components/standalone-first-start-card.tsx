'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Compass, Crown, Package, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  beginStandaloneBossOnboarding,
  beginStandaloneEinsatzOnboarding,
  beginStandaloneSoloOnboarding,
  needsFirstStartChoice,
  STANDALONE_ONBOARDING_CHANGED_EVENT,
} from '@/frontend/lib/standalone-onboarding'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

function ModeOption({
  icon,
  title,
  subtitle,
  detail,
  accentClass,
  onSelect,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  detail: string
  accentClass: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border border-border/70 bg-card/80 p-4 text-left shadow-sm transition-colors hover:border-border hover:bg-card',
        accentClass
      )}
    >
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <p className="text-xs text-muted-foreground/90">{detail}</p>
      </div>
    </button>
  )
}

export function StandaloneFirstStartCard(p: { className?: string; apiRole?: string | null }) {
  const { t } = useAppTranslation('standalone')
  const [showChoice, setShowChoice] = useState(() => needsFirstStartChoice(p.apiRole))

  useEffect(() => {
    const sync = () => setShowChoice(needsFirstStartChoice(p.apiRole))
    sync()
    window.addEventListener(STANDALONE_ONBOARDING_CHANGED_EVENT, sync)
    return () => window.removeEventListener(STANDALONE_ONBOARDING_CHANGED_EVENT, sync)
  }, [p.apiRole])

  if (!showChoice) return null

  return (
    <div
      className={cn(
        'mb-5 rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-4',
        p.className
      )}
    >
      <div className="flex items-start gap-3">
        <Compass className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t('firstStart.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('firstStart.description')}</p>
          </div>
          <div className="space-y-2">
            <ModeOption
              icon={<Crown className="h-5 w-5" aria-hidden />}
              title={t('firstStart.bossTitle')}
              subtitle={t('firstStart.bossSubtitle')}
              detail={t('firstStart.bossDetail')}
              accentClass="hover:border-amber-500/40"
              onSelect={() => beginStandaloneBossOnboarding()}
            />
            <ModeOption
              icon={<Package className="h-5 w-5" aria-hidden />}
              title={t('firstStart.einsatzTitle')}
              subtitle={t('firstStart.einsatzSubtitle')}
              detail={t('firstStart.einsatzDetail')}
              accentClass="hover:border-purple-500/40"
              onSelect={() => beginStandaloneEinsatzOnboarding()}
            />
            <ModeOption
              icon={<UserRound className="h-5 w-5" aria-hidden />}
              title={t('firstStart.soloTitle')}
              subtitle={t('firstStart.soloSubtitle')}
              detail={t('firstStart.soloDetail')}
              accentClass="hover:border-emerald-500/40"
              onSelect={() => beginStandaloneSoloOnboarding()}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('firstStart.tipEmptyBasisUrl')}</p>
        </div>
      </div>
    </div>
  )
}

/** Kompakte Variante für Einstellungen / erneuter Aufruf. */
export function StandaloneFirstStartActions(p: { apiRole?: string | null }) {
  const { t } = useAppTranslation('standalone')
  if (!needsFirstStartChoice(p.apiRole)) return null
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={() => beginStandaloneBossOnboarding()}>
        {t('firstStart.actionBoss')}
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => beginStandaloneEinsatzOnboarding()}>
        {t('firstStart.actionEinsatz')}
      </Button>
      <Button type="button" size="sm" onClick={() => beginStandaloneSoloOnboarding()}>
        {t('firstStart.actionSolo')}
      </Button>
    </div>
  )
}
