'use client'

import type { ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { KeyRound, Copy, Check, PlusCircle, Sprout, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VaultUnlockShell } from '@/frontend/components/vault-unlock-shell'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ApiStatus } from '@/frontend/lib/api'
import { fetchGenerateMnemonic } from '@/frontend/lib/api/generate-mnemonic'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { getCreateUnlockHintKeys, getImportUnlockHintKeys } from '@/frontend/lib/dashboard-unlock'
import { getStandaloneHelperReadiness } from '@/frontend/lib/handoff-standalone-ready'
import { isStandaloneEinsatzPath, isStandaloneSoloPath } from '@/frontend/lib/standalone-onboarding'
import { Trans, useAppTranslation } from '@/frontend/lib/i18n/hooks'
import { LocaleFlagSwitch } from '@/frontend/components/locale-flag-switch'
import { scheduleReleaseStuckModalPointerEvents, clearStuckRadixBodyLock } from '@/frontend/lib/release-modal-pointer-events'

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
  includeSdkMnemonicInBackup?: boolean
  onIncludeSdkMnemonicInBackupChange?: (v: boolean) => void
  onUnlock: () => void
  /** Optional: geführter Einrichtungs-Wizard statt sofort entsperren. */
  onOpenMessengerSetup?: () => void
  messengerSetupLabel?: string
  messengerSetupHint?: string
  /** Wizard-Schritt „Wallet“: Tresor schließen und Einrichtung fortsetzen. */
  onBackToWizard?: () => void
  backToWizardLabel?: string
  backToWizardHint?: string
  contextHint?: string
  /** Tresor über Einrichtungs-Wizard — vermeidet verschachtelte Modal-Fallen (APK-Freeze). */
  stackedOverModal?: boolean
}

function PasswordInput(p: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoComplete?: string
  onEnter?: () => void
  className?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={p.id}
        type={visible ? 'text' : 'password'}
        placeholder={p.placeholder}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        onKeyDown={p.onEnter ? (e) => e.key === 'Enter' && p.onEnter?.() : undefined}
        autoComplete={p.autoComplete}
        className={cn('h-11 pr-10', p.className)}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  )
}

function PasswordRepeatFeedback(p: { password: string; confirm: string; minLength?: number }) {
  const min = p.minLength ?? 0
  const hasConfirm = p.confirm.length > 0
  const hasPassword = p.password.length > 0
  if (!hasPassword && !hasConfirm) return null

  const longOk = min <= 0 || p.password.length >= min
  const matchOk = hasConfirm && p.password === p.confirm

  return (
    <ul className="space-y-1 text-xs" aria-live="polite">
      {min > 0 ? (
        <li className={longOk ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>
          {longOk ? '✓' : '○'} Mindestens {min} Zeichen
        </li>
      ) : null}
      {hasConfirm ? (
        <li
          className={
            matchOk ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'
          }
        >
          {matchOk ? '✓' : '✗'} Passwörter stimmen überein
        </li>
      ) : hasPassword ? (
        <li className="text-muted-foreground">○ Passwort wiederholen</li>
      ) : null}
    </ul>
  )
}

function CopyFieldButton(p: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const value = p.text.trim()
  if (!value) return null
  return (
    <Button
      type="button"
      size="sm"
      variant={copied ? 'secondary' : 'outline'}
      className={cn('h-8 shrink-0', copied && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300')}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        })
      }}
    >
      {copied ? (
        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      )}
      {copied ? 'Kopiert!' : p.label}
    </Button>
  )
}

function GeneratedAddressPanel(p: { address: string }) {
  const address = p.address.trim()
  if (!address) return null
  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Neue Adresse</p>
        <CopyFieldButton text={address} label="Adresse kopieren" />
      </div>
      <p className="break-all font-mono text-xs leading-relaxed text-foreground">{address}</p>
      <p className="text-xs text-muted-foreground">Seed sicher notieren, bevor du fortfährst.</p>
    </div>
  )
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
        <div className="min-w-0 space-y-4 overflow-hidden border-t border-border/60 px-4 pb-4 pt-1">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function VaultUnlockDialog(p: VaultUnlockDialogProps) {
  const { t, i18n } = useAppTranslation('vault')
  const [generatingMnemonic, setGeneratingMnemonic] = useState(false)
  const [generateMnemonicError, setGenerateMnemonicError] = useState('')
  const [generatedAddressHint, setGeneratedAddressHint] = useState('')

  const onGenerateMnemonic = async () => {
    setGenerateMnemonicError('')
    setGeneratedAddressHint('')
    setGeneratingMnemonic(true)
    try {
      const r = await fetchGenerateMnemonic()
      if (!r.ok) {
        setGenerateMnemonicError(r.error)
        return
      }
      p.onSignerImportChange(r.secretKey)
      p.onSignerImportConfirmChange(r.secretKey)
      setGeneratedAddressHint(r.address)
    } catch (e) {
      setGenerateMnemonicError(e instanceof Error ? e.message : String(e))
    } finally {
      setGeneratingMnemonic(false)
    }
  }

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
  const nativeVaultOverlay = standaloneApk && isCapacitorNativePlatform()
  const soloPath = standaloneApk && isStandaloneSoloPath()
  const helperReady = standaloneApk ? getStandaloneHelperReadiness() : null
  const [fullStandaloneUnlock, setFullStandaloneUnlock] = useState(false)
  const streamlined = Boolean(
    p.standaloneHelperUnlock &&
      helperReady?.hasHandoff &&
      isStandaloneEinsatzPath() &&
      !fullStandaloneUnlock
  )

  useEffect(() => {
    if (nativeVaultOverlay && p.open) {
      clearStuckRadixBodyLock()
      return
    }
    if (nativeVaultOverlay || p.open) return
    scheduleReleaseStuckModalPointerEvents()
  }, [nativeVaultOverlay, p.open])

  const createProfileReady =
    p.unlockMode === 'create' && !p.unlockButtonDisabled && !p.unlocking

  const sdkLikeCreate = p.signerKind === 'sdk' || p.signerKind == null
  const showCreateSeedFields = p.unlockMode === 'create' && (sdkLikeCreate || standaloneApk)
  const showSeedConfirmOnCreate = p.signerKind === 'sdk' && !standaloneApk
  const createPasswordMinLength = standaloneApk ? 8 : 0
  const createUnlockHints =
    p.unlockMode === 'create'
      ? getCreateUnlockHintKeys({
          unlocking: p.unlocking,
          unlockMode: p.unlockMode,
          signerKind: p.signerKind,
          password: p.password,
          passwordConfirm: p.passwordConfirm,
          signerImport: p.signerImport,
          signerImportConfirm: p.signerImportConfirm,
          showSignerImportOpen: p.showSignerImportOpen,
          standaloneWithoutBasis: standaloneApk,
          standaloneHelperUnlock: Boolean(p.standaloneHelperUnlock),
        })
      : []
  const importUnlockHints =
    p.unlockMode === 'import'
      ? getImportUnlockHintKeys({
          unlocking: p.unlocking,
          unlockMode: p.unlockMode,
          signerKind: p.signerKind,
          password: p.password,
          passwordConfirm: p.passwordConfirm,
          signerImport: p.signerImport,
          signerImportConfirm: p.signerImportConfirm,
          showSignerImportOpen: p.showSignerImportOpen,
          standaloneWithoutBasis: standaloneApk,
          standaloneHelperUnlock: Boolean(p.standaloneHelperUnlock),
        })
      : []

  const dialogTitle = streamlined
    ? t('title.streamlined')
    : soloPath
      ? t('title.solo')
      : standaloneApk
        ? t('title.standalone')
        : t('title.default')

  const dialogDescription = streamlined
    ? t('description.streamlined')
    : soloPath
      ? t('description.solo')
      : standaloneApk
        ? t('description.standalone')
        : t('description.default')

  return (
    <VaultUnlockShell
      open={p.open}
      nativeOverlay={nativeVaultOverlay}
      stackedOverModal={p.stackedOverModal}
      onDismiss={p.onBackToWizard}
    >
        <div className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              {nativeVaultOverlay ? (
                <>
                  <h2 className="text-xl font-semibold tracking-tight">{dialogTitle}</h2>
                  <p
                    className={cn(
                      'text-sm text-muted-foreground',
                      !dialogDescription.trim() && 'sr-only',
                    )}
                  >
                    {dialogDescription.trim() || dialogTitle}
                  </p>
                </>
              ) : (
                <>
                  <DialogTitle className="text-xl font-semibold tracking-tight">{dialogTitle}</DialogTitle>
                  <DialogDescription
                    className={cn(
                      'text-sm text-muted-foreground',
                      !dialogDescription.trim() && 'sr-only',
                    )}
                  >
                    {dialogDescription.trim() || dialogTitle}
                  </DialogDescription>
                </>
              )}
            </div>
            <LocaleFlagSwitch className="shrink-0" />
          </div>
        </div>

        <div key={i18n.resolvedLanguage || i18n.language} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {p.contextHint ? (
            <p className="rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-950 dark:text-sky-100">
              {p.contextHint}
            </p>
          ) : null}
          {!standaloneApk && p.apiSnapshot?.error && p.apiSnapshot.backendRunning !== true ? (
            <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
              <strong>Backend nicht erreichbar.</strong> Tresor-Entsperren braucht die API auf Port{' '}
              <span className="font-mono">3342</span>. Im Repo-Root starten:{' '}
              <span className="font-mono">npm run dev:messenger</span> (nicht nur{' '}
              <span className="font-mono">cd frontend && npm run dev:messenger</span>).
            </p>
          ) : null}
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
              {hasLocal ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">{t('import.importRecoverHint')}</p>
              ) : null}
              <div className="space-y-2">
                <PasswordInput
                  id="wallet-password-import"
                  placeholder={
                    hasLocal ? t('import.newPasswordPlaceholder') : t('import.vaultPasswordPlaceholder')
                  }
                  value={p.password}
                  onChange={p.onPasswordChange}
                  autoComplete="new-password"
                />
                <PasswordInput
                  id="wallet-password-import-2"
                  placeholder={t('import.confirmPasswordPlaceholder')}
                  value={p.passwordConfirm}
                  onChange={p.onPasswordConfirmChange}
                  autoComplete="new-password"
                />
                <PasswordRepeatFeedback
                  password={p.password}
                  confirm={p.passwordConfirm}
                  minLength={8}
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
            {showCreateSeedFields ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Wie im IOTA Wallet: Seed automatisch erzeugen oder eigene Wörter eintragen.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={generatingMnemonic}
                    onClick={() => void onGenerateMnemonic()}
                  >
                    {generatingMnemonic ? 'Erzeuge…' : 'Seed erzeugen'}
                  </Button>
                </div>
                {generateMnemonicError ? (
                  <p className="text-xs text-destructive">{generateMnemonicError}</p>
                ) : null}
                {generatedAddressHint ? <GeneratedAddressPanel address={generatedAddressHint} /> : null}
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="create-signer-a" className="text-xs text-muted-foreground">
                      {t('create.mnemonicLabel')}
                    </Label>
                    <CopyFieldButton text={p.signerImport} label="Seed kopieren" />
                  </div>
                  <Textarea
                    id="create-signer-a"
                    placeholder={t('create.mnemonicPlaceholder')}
                    value={p.signerImport}
                    onChange={(e) => p.onSignerImportChange(e.target.value)}
                    className="min-h-[72px] overflow-x-hidden font-mono text-xs break-all [overflow-wrap:anywhere]"
                    autoComplete="off"
                  />
                </div>
                {showSeedConfirmOnCreate ? (
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="create-signer-b" className="text-xs text-muted-foreground">
                      {t('create.repeatLabel')}
                    </Label>
                    <Textarea
                      id="create-signer-b"
                      placeholder={t('create.repeatPlaceholder')}
                      value={p.signerImportConfirm}
                      onChange={(e) => p.onSignerImportConfirmChange(e.target.value)}
                      className="min-h-[72px] overflow-x-hidden font-mono text-xs break-all [overflow-wrap:anywhere]"
                      autoComplete="off"
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="space-y-2">
              <PasswordInput
                id="wallet-password-create"
                placeholder={t('create.newPasswordPlaceholder')}
                value={p.password}
                onChange={p.onPasswordChange}
                autoComplete="new-password"
              />
              <PasswordInput
                id="wallet-password-create-2"
                placeholder={t('create.confirmPasswordPlaceholder')}
                value={p.passwordConfirm}
                onChange={p.onPasswordConfirmChange}
                autoComplete="new-password"
                onEnter={() => {
                  if (!p.unlockButtonDisabled) void p.onUnlock()
                }}
              />
              <PasswordRepeatFeedback
                password={p.password}
                confirm={p.passwordConfirm}
                minLength={createPasswordMinLength}
              />
            </div>
            {createUnlockHints.length > 0 && !p.unlocking ? (
              <p className="text-xs text-muted-foreground">{t('create.blockedHint')}</p>
            ) : null}
            <Button
              onClick={() => void p.onUnlock()}
              disabled={p.unlockButtonDisabled}
              variant={createProfileReady ? 'default' : 'secondary'}
              className={cn(
                'h-11 w-full',
                createProfileReady && 'bg-emerald-600 text-white hover:bg-emerald-700'
              )}
            >
              {p.unlocking ? t('create.creating') : t('create.create')}
            </Button>
          </OptionCard>

          {p.unlockError ? (
            <p className="whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {p.unlockError}
            </p>
          ) : null}
          {p.signerKind === 'sdk' && p.onIncludeSdkMnemonicInBackupChange ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={p.includeSdkMnemonicInBackup === true}
                onChange={(e) => p.onIncludeSdkMnemonicInBackupChange?.(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>
                <span className="font-medium text-foreground">{t('sdkMnemonicPref.label')}</span>
                <span className="mt-0.5 block">{t('sdkMnemonicPref.hint')}</span>
              </span>
            </label>
          ) : null}
            </>
          )}
        </div>

        {p.onBackToWizard ? (
          <div className="shrink-0 border-t border-border/60 bg-muted/20 px-4 py-3">
            <button
              type="button"
              className="w-full rounded-lg px-2 py-2 text-center text-sm transition-colors hover:bg-muted/50"
              onClick={p.onBackToWizard}
            >
              <span className="font-medium text-foreground">
                {p.backToWizardLabel ?? t('backToWizard.link')}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {p.backToWizardHint ?? t('backToWizard.hint')}
              </span>
            </button>
          </div>
        ) : p.onOpenMessengerSetup ? (
          <div className="shrink-0 border-t border-border/60 bg-muted/20 px-4 py-3">
            <button
              type="button"
              className="w-full rounded-lg px-2 py-2 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={p.onOpenMessengerSetup}
            >
              <span className="font-medium text-foreground">
                {p.messengerSetupLabel ?? t('messengerSetup.link')}
              </span>
              {p.messengerSetupHint ?? t('messengerSetup.hint') ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {p.messengerSetupHint ?? t('messengerSetup.hint')}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}
    </VaultUnlockShell>
  )
}
