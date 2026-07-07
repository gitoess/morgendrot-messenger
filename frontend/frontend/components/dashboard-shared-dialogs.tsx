'use client'

import { HelpCircle } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import type { DashboardUnlockMode } from '@/frontend/lib/dashboard-unlock'
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
import { VaultUnlockDialog } from '@/frontend/components/vault-unlock-dialog'

export function DashboardSharedDialogs(p: {
  locked: boolean
  suppressVaultUnlockForHelperSeed?: boolean
  /** Wizard offen: Tresor-Modal nicht darüber legen (Wallet-Schritt: „Wallet einrichten“ schließt Wizard). */
  suppressVaultUnlockForOnboardingWizard?: boolean
  showMessengerSetupInVault?: boolean
  onOpenMessengerSetupFromVault?: () => void
  messengerSetupVaultLabel?: string
  messengerSetupVaultHint?: string
  vaultOpenedFromWizard?: boolean
  onBackToWizardFromVault?: () => void
  backToWizardVaultLabel?: string
  backToWizardVaultHint?: string
  vaultContextHint?: string
  helpOpen: boolean
  onHelpOpenChange: (open: boolean) => void
  helpLoading: boolean
  helpText: string
  sessionSignerSync?: {
    open: boolean
    busy: boolean
    error: string
    password: string
    onPasswordChange: (v: string) => void
    onClose: () => void
    onSync: () => void | Promise<void>
  }
  unlock: {
    unlockMode: DashboardUnlockMode
    onUnlockModeChange: (m: DashboardUnlockMode) => void
    signerKind: ApiStatus['signer']
    apiSnapshot: (ApiStatus & { error?: string }) | null
    password: string
    setPassword: (v: string) => void
    passwordConfirm: string
    setPasswordConfirm: (v: string) => void
    signerImport: string
    setSignerImport: (v: string) => void
    signerImportConfirm: string
    setSignerImportConfirm: (v: string) => void
    showSignerImportOpen: boolean
    setShowSignerImportOpen: (v: boolean) => void
    includeSdkMnemonicInBackup: boolean
    setIncludeSdkMnemonicInBackup: (v: boolean) => void
    unlockError: string
    unlocking: boolean
    unlockButtonDisabled: boolean
    importMnemonicRequired: boolean
    standaloneHelperUnlock?: boolean
    handleUnlock: () => void | Promise<void>
  }
}) {
  const u = p.unlock
  return (
    <>
      <Dialog open={p.helpOpen} onOpenChange={p.onHelpOpenChange}>
        <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Hilfe
            </DialogTitle>
            <DialogDescription>
              Oben Kurzüberblick, darunter vollständige Befehlsliste — vom Backend
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm whitespace-pre-wrap">
            {p.helpLoading ? (
              <span className="text-muted-foreground">Lade…</span>
            ) : (
              p.helpText
            )}
          </div>
        </DialogContent>
      </Dialog>

      <VaultUnlockDialog
        open={
          p.locked &&
          !p.suppressVaultUnlockForHelperSeed &&
          !p.suppressVaultUnlockForOnboardingWizard
        }
        unlockMode={u.unlockMode}
        onUnlockModeChange={u.onUnlockModeChange}
        signerKind={u.signerKind}
        apiSnapshot={u.apiSnapshot}
        password={u.password}
        onPasswordChange={u.setPassword}
        passwordConfirm={u.passwordConfirm}
        onPasswordConfirmChange={u.setPasswordConfirm}
        signerImport={u.signerImport}
        onSignerImportChange={u.setSignerImport}
        signerImportConfirm={u.signerImportConfirm}
        onSignerImportConfirmChange={u.setSignerImportConfirm}
    showSignerImportOpen={u.showSignerImportOpen}
    onShowSignerImportOpenChange={u.setShowSignerImportOpen}
    includeSdkMnemonicInBackup={u.includeSdkMnemonicInBackup}
    onIncludeSdkMnemonicInBackupChange={u.setIncludeSdkMnemonicInBackup}
    unlockError={u.unlockError}
        unlocking={u.unlocking}
        unlockButtonDisabled={u.unlockButtonDisabled}
        importMnemonicRequired={u.importMnemonicRequired}
        standaloneHelperUnlock={u.standaloneHelperUnlock}
        onUnlock={() => void u.handleUnlock()}
        onOpenMessengerSetup={
          !p.vaultOpenedFromWizard && p.showMessengerSetupInVault
            ? p.onOpenMessengerSetupFromVault
            : undefined
        }
        messengerSetupLabel={p.messengerSetupVaultLabel}
        messengerSetupHint={p.messengerSetupVaultHint}
        onBackToWizard={p.vaultOpenedFromWizard ? p.onBackToWizardFromVault : undefined}
        backToWizardLabel={p.backToWizardVaultLabel}
        backToWizardHint={p.backToWizardVaultHint}
        contextHint={p.vaultContextHint}
        stackedOverModal={p.vaultOpenedFromWizard}
      />

      {p.sessionSignerSync ? (
        <Dialog
          open={p.sessionSignerSync.open}
          onOpenChange={(open) => !open && p.sessionSignerSync?.onClose()}
        >
          <DialogContent className="flex max-h-[min(92vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
            <DialogHeader className="space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
              <DialogTitle>Session-Signer laden</DialogTitle>
              <DialogDescription>
                Der Tresor ist bereits entsperrt. Mit dem Vault-Passwort wird der Session-Signer für Mainnet-Direkt-Send
                in diesen Browser geladen.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {p.vaultContextHint ? (
                <p className="rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-950 dark:text-sky-100">
                  {p.vaultContextHint}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="session-signer-vault-password">Vault-Passwort</Label>
                <Input
                  id="session-signer-vault-password"
                  type="password"
                  value={p.sessionSignerSync.password}
                  onChange={(e) => p.sessionSignerSync?.onPasswordChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !p.sessionSignerSync?.busy) void p.sessionSignerSync?.onSync()
                  }}
                  autoComplete="current-password"
                />
              </div>
              {p.sessionSignerSync.error ? (
                <p className="whitespace-pre-wrap text-sm text-destructive">{p.sessionSignerSync.error}</p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={p.sessionSignerSync.busy} onClick={p.sessionSignerSync.onClose}>
                  Abbrechen
                </Button>
                <Button
                  type="button"
                  disabled={p.sessionSignerSync.busy || !p.sessionSignerSync.password.trim()}
                  onClick={() => void p.sessionSignerSync?.onSync()}
                >
                  {p.sessionSignerSync.busy ? 'Lade …' : 'Signer laden'}
                </Button>
              </div>
            </div>
            {p.vaultOpenedFromWizard && p.onBackToWizardFromVault ? (
              <div className="shrink-0 border-t border-border/60 bg-muted/20 px-4 py-3">
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-2 text-center text-sm transition-colors hover:bg-muted/50"
                  onClick={p.onBackToWizardFromVault}
                >
                  <span className="font-medium text-foreground">
                    {p.backToWizardVaultLabel ?? 'Zurück zur Einrichtung'}
                  </span>
                  {p.backToWizardVaultHint ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{p.backToWizardVaultHint}</span>
                  ) : null}
                </button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
