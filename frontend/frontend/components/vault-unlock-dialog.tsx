'use client'

import type { ReactNode } from 'react'
import { ChevronDown, KeyRound, PlusCircle, Sprout } from 'lucide-react'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { ApiStatus } from '@/frontend/lib/api'

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

  return (
    <Dialog open={p.open} onOpenChange={() => {}}>
      <DialogContent
        className="flex max-h-[min(92vh,720px)] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden border-border/80 bg-background p-0 sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => p.open && e.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">Tresor entsperren</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Wähle eine Option — ohne Passwort bleibt der Messenger gesperrt.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <OptionCard
            active={p.unlockMode === 'vault'}
            accent
            onSelect={() => selectMode('vault')}
            icon={<KeyRound className="h-5 w-5" aria-hidden />}
            title="Tresor öffnen"
            subtitle="Mit Passwort entsperren"
          >
            {!hasLocal && p.signerKind === 'sdk' ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                Keine lokale Vault-Datei — nutze „Seed importieren“ oder „Neues Profil“.
              </p>
            ) : !hasLocal ? (
              <p className="text-xs text-muted-foreground">
                Keine lokale Datei: Wenn der Tresor nur auf der Chain liegt, das gleiche Vault-Passwort wie beim
                On-Chain-Speichern — nach dem Entsperren werden die Schlüssel von der Chain in die Sitzung geladen.
              </p>
            ) : null}
            {p.signerKind === 'sdk' && hasLocal ? (
              <p className="text-xs text-amber-700 dark:text-amber-200">
                Nur Passwort reicht, wenn beim letzten Speichern „Signer-Import mit speichern“ aktiv war. Sonst unten{' '}
                <strong className="text-foreground">Seed importieren</strong> wählen und Mnemonic/Secret eintragen.
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="wallet-password" className="sr-only">
                Passwort
              </Label>
              <Input
                id="wallet-password"
                type="password"
                placeholder="Passwort"
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
                    Mnemonic (nur falls nötig)
                  </Label>
                  <Textarea
                    id="wallet-signer-import"
                    placeholder="24 Wörter …"
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
                    Ausblenden
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => p.onShowSignerImportOpenChange(true)}
                >
                  Mnemonic ergänzen (erweitert)
                </button>
              )
            ) : null}
            <Button
              onClick={() => void p.onUnlock()}
              disabled={p.unlockButtonDisabled}
              className="h-12 w-full bg-emerald-600 text-base font-medium hover:bg-emerald-600/90"
            >
              {p.unlocking ? 'Wird entsperrt…' : 'Entsperren'}
            </Button>
          </OptionCard>

          {showImport ? (
            <OptionCard
              active={p.unlockMode === 'import'}
              onSelect={() => selectMode('import')}
              icon={<Sprout className="h-5 w-5" aria-hidden />}
              title="Seed importieren"
              subtitle="Bestehendes Profil wiederherstellen (24 Wörter)"
            >
              <p className="text-xs text-muted-foreground">
                Vault-Passwort <strong className="text-foreground">und</strong> dein IOTA-Mnemonic (12–24 Wörter) oder
                Bech32-Secret — Pflicht bei <span className="font-mono">SIGNER=sdk</span> ohne gespeicherten Import.
              </p>
              <div className="space-y-2">
                <Label htmlFor="wallet-password-import" className="sr-only">
                  Passwort
                </Label>
                <Input
                  id="wallet-password-import"
                  type="password"
                  placeholder="Vault-Passwort"
                  value={p.password}
                  onChange={(e) => p.onPasswordChange(e.target.value)}
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-signer" className="text-xs text-muted-foreground">
                  Mnemonic / Secret (Pflicht)
                </Label>
                <Textarea
                  id="import-signer"
                  placeholder="24 Wörter oder Bech32-Secret …"
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
                {p.unlocking ? 'Import läuft…' : 'Profil wiederherstellen'}
              </Button>
            </OptionCard>
          ) : null}

          <OptionCard
            active={p.unlockMode === 'create'}
            onSelect={() => selectMode('create')}
            icon={<PlusCircle className="h-5 w-5" aria-hidden />}
            title="Neues Profil anlegen"
            subtitle="Frischen Tresor erstellen"
          >
            {hasLocal ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                Es gibt bereits eine Vault-Datei — meist reicht „Tresor öffnen“.
              </p>
            ) : null}
            {p.signerKind === 'sdk' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="create-signer-a" className="text-xs text-muted-foreground">
                    Mnemonic / Secret
                  </Label>
                  <Textarea
                    id="create-signer-a"
                    placeholder="24 Wörter …"
                    value={p.signerImport}
                    onChange={(e) => p.onSignerImportChange(e.target.value)}
                    className="min-h-[72px] font-mono text-xs"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-signer-b" className="text-xs text-muted-foreground">
                    Wiederholen
                  </Label>
                  <Textarea
                    id="create-signer-b"
                    placeholder="Erneut eingeben"
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
                placeholder="Neues Passwort"
                value={p.password}
                onChange={(e) => p.onPasswordChange(e.target.value)}
                autoComplete="new-password"
                className="h-11"
              />
              <Input
                id="wallet-password-create-2"
                type="password"
                placeholder="Passwort wiederholen"
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
              {p.unlocking ? 'Wird angelegt…' : 'Profil anlegen'}
            </Button>
          </OptionCard>

          {p.unlockError ? (
            <p className="whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {p.unlockError}
            </p>
          ) : null}

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground">
              <span>Technische Hinweise</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                Entsperrt die <strong className="text-foreground">Server-Sitzung</strong> zum Signieren. Das Passwort
                entschlüsselt die Vault-Datei auf dem Gerät bzw. der Basis.
              </p>
              {p.signerKind === 'cli' ? (
                <p>
                  <span className="font-mono">SIGNER=cli</span>: Passwort des IOTA-CLI-Keystores — kein Mnemonic hier.
                </p>
              ) : p.signerKind === 'sdk' ? (
                <p>
                  <span className="font-mono">SIGNER=sdk</span>: Nach einmaligem Import reicht oft nur noch das Passwort
                  unter „Tresor öffnen“.
                </p>
              ) : p.signerKind === 'remote' ? (
                <p>
                  <span className="font-mono">SIGNER=remote</span>: Vault-Passwort; Signatur extern.
                </p>
              ) : null}
              <p>
                <strong className="text-foreground">Passwort vergessen?</strong> Vault-Inhalt ohne altes Passwort nicht
                lesbar. Mit Seed lässt sich ein neues Profil anlegen — alte Messaging-Keys bleiben in der alten Vault.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  )
}
