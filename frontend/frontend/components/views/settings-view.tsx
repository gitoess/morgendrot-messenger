'use client'

import { useState, useEffect } from 'react'
import { Settings, Copy, Check, KeyRound } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  getStatus,
  fetchStatus,
  revealVaultSignerImport,
  type ApiStatus,
} from '@/frontend/lib/api'
import Link from 'next/link'
import { HandoffImportPanel } from '@/frontend/components/handoff-import-panel'
import { EinsatzEndPanel } from '@/frontend/components/einsatz-end-panel'
import { ActiveProfilePanel } from '@/frontend/components/active-profile-panel'
import { SettingsTelegramIntegration } from '@/frontend/components/views/settings-telegram-integration'
import { SettingsTelegramNotifyOnSend } from '@/frontend/components/views/settings-telegram-notify-on-send'
import { SettingsSystemIdentitySection } from '@/frontend/components/views/settings-system-identity-section'
import { SettingsMyMailboxesSection } from '@/frontend/components/views/settings-my-mailboxes-section'
import { ChatViewShadowSweep } from '@/frontend/components/chat-view-shadow-sweep'
import { SettingsLanguageSection } from '@/frontend/components/settings-language-section'
import { SettingsExpertModeSection } from '@/frontend/components/settings-expert-mode-section'
import { CapacitorApiBaseCard } from '@/frontend/components/capacitor-api-base-card'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

interface SettingsViewProps {
  onOpenConfig?: () => void
  /** Arbeiter/Lock: Kachel-Ansicht dauerhaft (localStorage). */
  showAllTiles?: boolean
  onShowAllTilesChange?: (value: boolean) => void
  canToggleFullTiles?: boolean
  /** Messenger Boss/Kommandant: nur was nicht auf Startseite / Einsatzleitung / Tresor liegt. */
  slimMessengerEinsatz?: boolean
}

export function SettingsView({
  onOpenConfig,
  showAllTiles = false,
  onShowAllTilesChange,
  canToggleFullTiles = false,
  slimMessengerEinsatz = false,
}: SettingsViewProps) {
  const { t } = useAppTranslation('dashboard')
  const [status, setStatus] = useState<{
    network: string
    address: string
    packageId: string
    backendOnline: boolean
    chatConnected: boolean
    signer?: string
    vaultHasLocal?: boolean
    role?: string
  } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  
  /** Recovery phrase / SDK-Import aus Vault (SIGNER=sdk). */
  const [recoveryPw, setRecoveryPw] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryErr, setRecoveryErr] = useState('')
  const [revealedSigner, setRevealedSigner] = useState<string | null>(null)

  const [advancedIotaStatus, setAdvancedIotaStatus] = useState<ApiStatus | null>(null)

  const isBossRole =
    (advancedIotaStatus?.role || status?.role || '').trim().toLowerCase() === 'boss'

  const backendOnline =
    status?.backendOnline === true ||
    advancedIotaStatus?.backendRunning === true ||
    advancedIotaStatus?.backendOnline === true

  const loadStatus = async () => {
    const res = await getStatus()
    if (res.ok && res.data) {
      setStatus(res.data)
    }
    const adv = await fetchStatus()
    if ('pollClockHint' in adv) setAdvancedIotaStatus(adv)
    else setAdvancedIotaStatus(null)
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRevealSignerImport = async () => {
    setRecoveryErr('')
    if (!recoveryPw.trim()) {
      setRecoveryErr('Vault-Passwort eingeben.')
      return
    }
    setRecoveryBusy(true)
    try {
      const res = await revealVaultSignerImport(recoveryPw.trim())
      if (res.ok && res.signerImport) {
        setRevealedSigner(res.signerImport)
        setRecoveryPw('')
      } else {
        setRecoveryErr(res.error || res.message || 'Anzeige fehlgeschlagen.')
      }
    } finally {
      setRecoveryBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('views.settings')}</h2>
          <p className="text-sm text-muted-foreground">
            {slimMessengerEinsatz ? t('settings.subtitleSlim') : t('settings.subtitleDefault')}
          </p>
        </div>
      </div>

      <SettingsLanguageSection />

      <SettingsExpertModeSection apiStatus={advancedIotaStatus} />

      <ActiveProfilePanel status={advancedIotaStatus} />

      <SettingsSystemIdentitySection
        apiStatus={advancedIotaStatus}
        onApplied={() => void loadStatus()}
      />

      <SettingsMyMailboxesSection
        apiStatus={advancedIotaStatus}
        myAddress={
          (advancedIotaStatus?.myAddressFull || advancedIotaStatus?.myAddress || status?.address || '').trim()
        }
      />

      {backendOnline ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <ChatViewShadowSweep />
        </div>
      ) : null}

      <CapacitorApiBaseCard />

      <EinsatzEndPanel backendOnline={backendOnline} />

      {(!slimMessengerEinsatz || !isBossRole) ? (
        <HandoffImportPanel backendOnline={backendOnline} />
      ) : null}

      {!slimMessengerEinsatz && status?.backendOnline ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h4 className="font-semibold text-foreground">Wallet & Backup</h4>
            </div>
          </div>

          {status.signer === 'sdk' ? (
            <>
              {!status.vaultHasLocal ? (
                <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                  Keine lokale Vault-Datei — im Tresor <strong className="font-medium">lokal sichern</strong> (optional
                  Signer-Import) oder von der Chain laden.
                </p>
              ) : null}
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="text-muted-foreground">Vault-Passwort (erneut eingeben)</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={recoveryPw}
                    onChange={(e) => setRecoveryPw(e.target.value)}
                    className="mt-1 w-full max-w-md rounded-lg border border-border bg-input px-3 py-2 text-foreground"
                    placeholder="••••••••"
                  />
                </label>
                {recoveryErr ? <p className="text-sm text-destructive">{recoveryErr}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={recoveryBusy || !status.vaultHasLocal}
                    onClick={() => void handleRevealSignerImport()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {recoveryBusy ? 'Lade…' : 'Recovery / Signer-Import anzeigen'}
                  </button>
                  {revealedSigner ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRevealedSigner(null)
                        setRecoveryErr('')
                      }}
                      className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
                    >
                      Ausblenden
                    </button>
                  ) : null}
                </div>
                {revealedSigner ? (
                  <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                      Nur an einem sicheren Ort notieren — nicht teilen, nicht Screenshots in unsichere Clouds.
                    </p>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/50 p-3 font-mono text-xs text-foreground">
                      {revealedSigner}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(revealedSigner)
                        setCopied('signerImport')
                        setTimeout(() => setCopied(null), 2000)
                      }}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {copied === 'signerImport' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      In Zwischenablage kopieren
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">SIGNER={status.signer ?? '?'}</span> — Vault-Mnemonic-Anzeige nur bei{' '}
              <span className="font-mono">sdk</span>. Bei <span className="font-mono">cli</span> /{' '}
              <span className="font-mono">remote</span>:{' '}
              <Link
                href="/handbook?file=RECOVERY-PHRASE-BACKUP.md"
                className="text-primary underline underline-offset-2 hover:text-primary/90"
              >
                Handbuch
              </Link>
              .
            </p>
          )}
        </div>
      ) : null}

      <SettingsTelegramNotifyOnSend />
      <SettingsTelegramIntegration backendOnline={backendOnline} />

      {canToggleFullTiles && onShowAllTilesChange && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-foreground">Volle Oberfläche</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Alle Funktions-Kacheln anzeigen (wie nach „Alle Funktionen“ auf dem Dashboard). Wird in diesem Browser gespeichert.
              </p>
            </div>
            <Switch
              checked={showAllTiles}
              onCheckedChange={onShowAllTilesChange}
              aria-label="Alle Kacheln anzeigen"
            />
          </div>
        </div>
      )}

    </div>
  )
}
