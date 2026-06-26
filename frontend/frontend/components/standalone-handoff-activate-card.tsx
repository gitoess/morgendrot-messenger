'use client'

import { useEffect, useState } from 'react'
import { Check, KeyRound, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  getStandaloneHelperReadiness,
  STANDALONE_HANDOFF_APPLIED_EVENT,
} from '@/frontend/lib/handoff-standalone-ready'
import {
  beginStandaloneSoloOnboarding,
  isStandaloneEinsatzPath,
  isStandaloneSoloPath,
  needsFirstStartChoice,
  STANDALONE_ONBOARDING_CHANGED_EVENT,
} from '@/frontend/lib/standalone-onboarding'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

function StepRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <Check
        className={cn('h-4 w-4 shrink-0', ok ? 'text-emerald-500' : 'text-muted-foreground/40')}
        aria-hidden
      />
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  )
}

export function StandaloneHandoffActivateCard(p: {
  onOpenHandoffImport: () => void
  onActivateWallet: () => void
  className?: string
  apiRole?: string | null
}) {
  const { t, i18n } = useAppTranslation('standalone')
  const [, bump] = useState(0)
  useEffect(() => {
    const sync = () => bump((n) => n + 1)
    window.addEventListener(STANDALONE_ONBOARDING_CHANGED_EVENT, sync)
    window.addEventListener(STANDALONE_HANDOFF_APPLIED_EVENT, sync)
    window.addEventListener(DIRECT_IOTA_UI_CHANGED, sync)
    i18n.on('languageChanged', sync)
    return () => {
      window.removeEventListener(STANDALONE_ONBOARDING_CHANGED_EVENT, sync)
      window.removeEventListener(STANDALONE_HANDOFF_APPLIED_EVENT, sync)
      window.removeEventListener(DIRECT_IOTA_UI_CHANGED, sync)
      i18n.off('languageChanged', sync)
    }
  }, [i18n])

  const r = getStandaloneHelperReadiness()
  const solo = isStandaloneSoloPath()
  const einsatzHelper = isStandaloneEinsatzPath()
  if ((!r.standaloneMode && !einsatzHelper) || r.readyForChat || needsFirstStartChoice(p.apiRole)) return null
  if (solo && !r.needsMnemonic && !r.readyForChat) return null

  if (!r.hasHandoff) {
    return (
      <div
        className={cn(
          'mb-5 rounded-xl border border-purple-500/35 bg-purple-500/10 px-4 py-4',
          p.className
        )}
      >
        <div className="flex items-start gap-3">
          <Package className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t('handoff.step1Title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('handoff.step1Description')}</p>
            </div>
            <Button type="button" onClick={p.onOpenHandoffImport}>
              {t('handoff.importZip')}
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => beginStandaloneSoloOnboarding()}
            >
              {t('handoff.switchToSolo')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const cfg = r.configuredFromHandoff
  return (
    <div
      className={cn(
        'mb-5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-4',
        p.className
      )}
    >
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {solo ? t('handoff.walletSetupTitle') : t('handoff.step2Title')}
              {r.handoffLabel ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">({r.handoffLabel})</span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {solo ? t('handoff.step2DescriptionSolo') : t('handoff.step2DescriptionEinsatz')}
            </p>
          </div>
          {!solo ? (
            <ul className="space-y-1">
              <StepRow ok={cfg.packageId} label={t('handoff.checkPackageId')} />
              <StepRow ok={cfg.mailboxId} label={t('handoff.checkMailboxId')} />
              <StepRow ok={cfg.rpcUrl} label={t('handoff.checkRpcUrl')} />
              <StepRow ok={cfg.directMode && cfg.drain} label={t('handoff.checkDirectMode')} />
            </ul>
          ) : null}
          <Button type="button" onClick={p.onActivateWallet}>
            {solo ? t('handoff.openWalletDialog') : t('handoff.activateWallet')}
          </Button>
        </div>
      </div>
    </div>
  )
}
