'use client'

import { useCallback, useEffect, useState } from 'react'
import { Globe, Network } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ApiStatus } from '@/frontend/lib/api/status'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'
import {
  STANDALONE_HANDOFF_APPLIED_EVENT,
} from '@/frontend/lib/handoff-standalone-ready'
import {
  STANDALONE_ONBOARDING_CHANGED_EVENT,
} from '@/frontend/lib/standalone-onboarding'
import {
  applyStandaloneSoloChainConfig,
  getStandaloneSoloChainDefaults,
  needsStandaloneSoloChainWizard,
  pickSoloChainPrefillFromApiStatus,
  readStandaloneSoloChainFormValues,
  type StandaloneSoloChainApplyError,
} from '@/frontend/lib/standalone-solo-setup'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('h-9 text-sm', mono && 'font-mono text-xs')}
        spellCheck={false}
        autoComplete="off"
      />
    </label>
  )
}

export function StandaloneSoloWizardCard(p: {
  apiSnapshot?: ApiStatus | null
  className?: string
}) {
  const { t } = useAppTranslation('standalone')
  const [, bump] = useState(0)
  const [form, setForm] = useState(readStandaloneSoloChainFormValues)
  const [error, setError] = useState<StandaloneSoloChainApplyError | null>(null)
  const [saved, setSaved] = useState(false)

  const syncForm = useCallback(() => {
    setForm(readStandaloneSoloChainFormValues())
    bump((n) => n + 1)
  }, [])

  useEffect(() => {
    const onChange = () => syncForm()
    window.addEventListener(STANDALONE_ONBOARDING_CHANGED_EVENT, onChange)
    window.addEventListener(STANDALONE_HANDOFF_APPLIED_EVENT, onChange)
    window.addEventListener(DIRECT_IOTA_UI_CHANGED, onChange)
    return () => {
      window.removeEventListener(STANDALONE_ONBOARDING_CHANGED_EVENT, onChange)
      window.removeEventListener(STANDALONE_HANDOFF_APPLIED_EVENT, onChange)
      window.removeEventListener(DIRECT_IOTA_UI_CHANGED, onChange)
    }
  }, [syncForm])

  if (!needsStandaloneSoloChainWizard()) return null

  const bossPrefill = pickSoloChainPrefillFromApiStatus(p.apiSnapshot)
  const canPrefillFromBoss = Boolean(bossPrefill.packageId || bossPrefill.mailboxId || bossPrefill.rpcUrl)

  const applyTestnetTemplate = () => {
    setForm(getStandaloneSoloChainDefaults())
    setError(null)
    setSaved(false)
  }

  const applyBossPrefill = () => {
    setForm((prev) => ({
      rpcUrl: bossPrefill.rpcUrl ?? prev.rpcUrl,
      packageId: bossPrefill.packageId ?? prev.packageId,
      mailboxId: bossPrefill.mailboxId ?? prev.mailboxId,
    }))
    setError(null)
    setSaved(false)
  }

  const onSave = () => {
    setError(null)
    setSaved(false)
    const result = applyStandaloneSoloChainConfig(form)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSaved(true)
    syncForm()
  }

  return (
    <div
      className={cn(
        'mb-5 rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-4',
        p.className
      )}
    >
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t('soloWizard.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('soloWizard.description')}</p>
          </div>

          <div className="space-y-3">
            <Field
              id="solo-rpc-url"
              label={t('soloWizard.rpcUrlLabel')}
              value={form.rpcUrl}
              onChange={(rpcUrl) => {
                setForm((f) => ({ ...f, rpcUrl }))
                setSaved(false)
              }}
              placeholder={SOLO_TESTNET_RPC_PLACEHOLDER}
            />
            <Field
              id="solo-package-id"
              label={t('soloWizard.packageIdLabel')}
              value={form.packageId}
              onChange={(packageId) => {
                setForm((f) => ({ ...f, packageId }))
                setSaved(false)
              }}
              placeholder="0x…"
              mono
            />
            <Field
              id="solo-mailbox-id"
              label={t('soloWizard.mailboxIdLabel')}
              value={form.mailboxId}
              onChange={(mailboxId) => {
                setForm((f) => ({ ...f, mailboxId }))
                setSaved(false)
              }}
              placeholder="0x…"
              mono
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={applyTestnetTemplate}>
              <Globe className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {t('soloWizard.loadTestnetTemplate')}
            </Button>
            {canPrefillFromBoss ? (
              <Button type="button" variant="outline" size="sm" onClick={applyBossPrefill}>
                {t('soloWizard.prefillFromBoss')}
              </Button>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {t(`soloWizard.errors.${error}`)}
            </p>
          ) : null}
          {saved ? (
            <p className="text-sm text-emerald-400" role="status">
              {t('soloWizard.savedOk')}
            </p>
          ) : null}

          <Button type="button" onClick={onSave}>
            {t('soloWizard.saveAndContinue')}
          </Button>
        </div>
      </div>
    </div>
  )
}

const SOLO_TESTNET_RPC_PLACEHOLDER = 'https://api.testnet.iota.cafe'
