'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { KeyRound, PlusCircle, Sprout } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ApiStatus } from '@/frontend/lib/api'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'
import { getStandaloneHelperReadiness } from '@/frontend/lib/handoff-standalone-ready'
import { isStandaloneEinsatzPath, isStandaloneSoloPath } from '@/frontend/lib/standalone-onboarding'
import { Trans, useAppTranslation } from '@/frontend/lib/i18n/hooks'
import { LocaleFlagSwitch } from '@/frontend/components/locale-flag-switch'

export type VaultUnlockMode = 'vault' | 'import' | 'create'

export type VaultUnlockDialogProps = {
  open: boolean
  unlockMode: VaultUnlockMode
  onUnlockModeChange: (mode: VaultUnlockMode) => void
  signerKind: string | undefined
  apiSnapshot: (ApiStatus & { error?: string }) | null
  password: string
  onPasswordChange: (v: string) => void
  passwordConfirm: string
  onPasswordConfirmChange: (v: string) => void
  signerImport: string
  onSignerImportChange: (v: string) => void
  signerImportConfirm: string
  onSignerImportConfirmChange: (v: string) => void
  showSignerImportOpen: boolean
  onShowSignerImportOpenChange: (v: boolean) => void
  unlockError: string
  unlocking: boolean
  unlockButtonDisabled: boolean
  importMnemonicRequired: boolean
  standaloneHelperUnlock?: boolean
  onUnlock: () => void
}

function OptionCard({
  active,
  accent,
  onSelect,
  icon,
  title,
  subtitle,
  children,
}: {
  active: boolean
  accent?: boolean
  onSelect: () => void
  icon: ReactNode
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-card/80 shadow-sm transition-[border-color,box-shadow,background]',
        active
          ? accent
            ? 'border-emerald-500/45 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/20'
            : 'border-border shadow-md ring-1 ring-border/80'
          : 'border-border/60 hover:border-border hover:bg-card'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div
          className={cn(
            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            active && accent ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </button>
      {active && children ? (
        <div className="space-y-4 border-t border-border/60 px-4 pb-4 pt-1">{children}</div>
      ) : null}
    </div>
  )
}

export function VaultUnlockDialog(p: VaultUnlockDialogProps) {
  const { t, i18n } = useAppTranslation('vault')
  const selectMode = (m: VaultUnlockMode) => {
    p.onUnlockModeChange(m)
    if (m === 'vault') {
      p.onShowSignerImportOpenChange(false)
      p.onSignerImportConfirmChange('')
    } else if (m === 'import') {
      p.onShowSignerImportOpenChange(true)
      p.onSignerImportConfirmChange('')
    } else {
      p.onShowSignerImportOpenChange(false)
    }
  }

  const hasLocal = p.apiSnapshot?.vaultStatus?.hasLocal
  const showImport = p.signerKind === 'sdk' || p.signerKind == null
  const standaloneApk = isStandaloneMessengerWithoutBasis()
  const soloPath = standaloneApk && isStandaloneSoloPath()
  const helperReady = standaloneApk ? getStandaloneHelperReadiness() : null
  const [fullStandaloneUnlock, setFullStandaloneUnlock] = useState(false)
  const streamlined = Boolean(
    p.standaloneHelperUnlock &&
      helperReady?.hasHandoff &&
      isStandaloneEinsatzPath() &&
      !fullStandaloneUnlock
  )

  return (
    <Dialog open={p.open} onOpenChange={() => {}}>
      <DialogContent
        className="flex max-h-[min(92vh,720px)] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden border-border/80 bg-background p-0 sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => p.open && e.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {streamlined
                  ? t('title.streamlined')
                  : soloPath
                    ? t('title.solo')
                    : standaloneApk
                      ? t('title.standalone')
                      : t('title.default')}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {streamlined
                  ? t('description.streamlined')
                  : soloPath
                    ? t('description.solo')
                    : standaloneApk
                      ? t('description.standalone')
                      : t('description.default')}
              </DialogDescription>
            </div>
            <LocaleFlagSwitch className="shrink-0" />
          </div>
        </DialogHeader>

        <div key={i18n.resolvedLanguage || i18n.language} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {streamlined ? (
            <div className="space-y-3">
              <Label htmlFor="standalone-helper-mnemonic">{t('streamlined.walletKeyLabel')}</Label>
              <Textarea
                id="standalone-helper-mnemonic"
                value={p.signerImport}
                onChange={(e) => p.onSignerImportChange(e.target.value)}
                placeholder={t('streamlined.walletKeyPlaceholder')}
                className="min-h-[120px] font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">{t('streamlined.hint')}</p>
              <Input
                type="password"
                placeholder={t('streamlined.appPasswordOptional')}
                value={p.password}
                onChange={(e) => p.onPasswordChange(e.target.value)}
                autoComplete="new-password"
                className="h-11"
              />
              {p.unlockError ? (
                <p className="text-sm text-destructive whitespace-pre-wrap">{p.unlockError}</p>
              ) : null}
              <Button
                type="button"
                className="h-12 w-full text-base"
                disabled={p.unlockButtonDisabled || p.unlocking}
                onClick={p.onUnlock}
              >
                {p.unlocking ? t('streamlined.activating') : t('streamlined.activateChat')}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => {
                  setFullStandaloneUnlock(true)
                  p.onUnlockModeChange('create')
                  p.onShowSignerImportOpenChange(true)
                }}
              >
                {t('streamlined.advancedCreate')}
              </button>
            </div>
          ) : (
            <>
          <OptionCard
            active={p.unlockMode === 'vault'}
            accent
            onSelect={() => selectMode('vault')}
            icon={<KeyRound className="h-5 w-5" aria-hidden />}
            title={t('vault.title')}
            subtitle={t('vault.subtitle')}
          >
            {!hasLocal && p.signerKind === 'sdk' ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">{t('vault.noLocalFileSdk')}</p>
            ) : !hasLocal ? (
              <p className="text-xs text-muted-foreground">{t('vault.noLocalFileChain')}</p>
            ) : null}
            {p.signerKind === 'sdk' && hasLocal ? (
              <p className="text-xs text-amber-700 dark:text-amber-200">
                <Trans
                  ns="vault"
                  i18nKey="vault.sdkLocalHint"
                  components={{ strong: <strong className="text-foreground" /> }}
                />
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="wallet-password" className="sr-only">
                {t('vault.passwordLabel')}
              </Label>
              <Input
                id="wallet-password"
                type="password"
                placeholder={t('vault.passwordPlaceholder')}
                value={p.password}
                onChange={(e) => p.onPasswordChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !p.unlockButtonDisabled && p.onUnlock()}
                autoComplete="current-password"
                className="h-12 text-base"
              />
            </div>
            {p.signerKind === 'sdk' && hasLocal ? (
              p.showSignerImportOpen ? (
                <div className="space-y-2">
                  <Label htmlFor="wallet-signer-import" className="text-xs text-muted-foreground">
                    {t('vault.mnemonicOptionalLabel')}
                  </Label>
                  <Textarea
                    id="wallet-signer-import"
                    placeholder={t('vault.mnemonicPlaceholder')}
                    value={p.signerImport}
                    onChange={(e) => p.onSignerImportChange(e.target.value)}
                    className="min-h-[72px] font-mono text-xs"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      p.onShowSignerImportOpenChange(false)
                      p.onSignerImportChange('')
                    }}
                  >
                    {t('vault.hideMnemonic')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => p.onShowSignerImportOpenChange(true)}
                >
                  {t('vault.showMnemonic')}
                </button>
              )
            ) : null}
            <Button
              onClick={() => void p.onUnlock()}
              disabled={p.unlockButtonDisabled}
              className="h-12 w-full bg-emerald-600 text-base font-medium hover:bg-emerald-600/90"
            >
              {p.unlocking ? t('vault.unlocking') : t('vault.unlock')}
            </Button>
          </OptionCard>

          {showImport ? (
            <OptionCard
              active={p.unlockMode === 'import'}
              onSelect={() => selectMode('import')}
              icon={<Sprout className="h-5 w-5" aria-hidden />}
              title={t('import.title')}
              subtitle={t('import.subtitle')}
            >
              <p className="text-xs text-muted-foreground">
                <Trans
                  ns="vault"
                  i18nKey="import.hint"
                  components={{
                    strong: <strong className="text-foreground" />,
                    mono: <span className="font-mono" />,
                  }}
                />
              </p>
              <div className="space-y-2">
                <Label htmlFor="wallet-password-import" className="sr-only">
                  {t('vault.passwordLabel')}
                </Label>
                <Input
                  id="wallet-password-import"
                  type="password"
                  placeholder={t('import.vaultPasswordPlaceholder')}
                  value={p.password}
                  onChange={(e) => p.onPasswordChange(e.target.value)}
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-signer" className="text-xs text-muted-foreground">
                  {t('import.mnemonicLabel')}
                </Label>
                <Textarea
                  id="import-signer"
                  placeholder={t('import.mnemonicPlaceholder')}
                  value={p.signerImport}
                  onChange={(e) => p.onSignerImportChange(e.target.value)}
                  className="min-h-[88px] font-mono text-xs"
                  autoComplete="off"
                />
              </div>
              <Button
                onClick={() => void p.onUnlock()}
                disabled={p.unlockButtonDisabled}
                variant="secondary"
                className="h-11 w-full"
              >
                {p.unlocking ? t('import.importing') : t('import.restore')}
              </Button>
            </OptionCard>
          ) : null}

          <OptionCard
            active={p.unlockMode === 'create'}
            onSelect={() => selectMode('create')}
            icon={<PlusCircle className="h-5 w-5" aria-hidden />}
            title={t('create.title')}
            subtitle={t('create.subtitle')}
          >
            {hasLocal ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">{t('create.existingVault')}</p>
            ) : null}
            {p.signerKind === 'sdk' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="create-signer-a" className="text-xs text-muted-foreground">
                    {t('create.mnemonicLabel')}
                  </Label>
                  <Textarea
                    id="create-signer-a"
                    placeholder={t('create.mnemonicPlaceholder')}
                    value={p.signerImport}
                    onChange={(e) => p.onSignerImportChange(e.target.value)}
                    className="min-h-[72px] font-mono text-xs"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-signer-b" className="text-xs text-muted-foreground">
                    {t('create.repeatLabel')}
                  </Label>
                  <Textarea
                    id="create-signer-b"
                    placeholder={t('create.repeatPlaceholder')}
                    value={p.signerImportConfirm}
                    onChange={(e) => p.onSignerImportConfirmChange(e.target.value)}
                    className="min-h-[72px] font-mono text-xs"
                    autoComplete="off"
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <Input
                id="wallet-password-create"
                type="password"
                placeholder={t('create.newPasswordPlaceholder')}
                value={p.password}
                onChange={(e) => p.onPasswordChange(e.target.value)}
                autoComplete="new-password"
                className="h-11"
              />
              <Input
                id="wallet-password-create-2"
                type="password"
                placeholder={t('create.confirmPasswordPlaceholder')}
                value={p.passwordConfirm}
                onChange={(e) => p.onPasswordConfirmChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !p.unlockButtonDisabled && p.onUnlock()}
                autoComplete="new-password"
                className="h-11"
              />
            </div>
            <Button
              onClick={() => void p.onUnlock()}
              disabled={p.unlockButtonDisabled}
              variant="secondary"
              className="h-11 w-full"
            >
              {p.unlocking ? t('create.creating') : t('create.create')}
            </Button>
          </OptionCard>

          {p.unlockError ? (
            <p className="whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {p.unlockError}
            </p>
          ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
